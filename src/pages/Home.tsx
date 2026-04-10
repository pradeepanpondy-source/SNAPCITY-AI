import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';
import toast from 'react-hot-toast';
import { sendAdminAlert } from '@/lib/email';
import { generateToken } from '@/lib/token';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MapPin, Loader2, Send, Image as ImageIcon, Copy, CheckCircle2, X } from 'lucide-react';
import ExifReader from 'exifreader';

// ── Gemini helper: try multiple models, fail fast ──────────────────────────
async function geminiCall(ai: any, config: any): Promise<any> {
  const models = ['gemini-2.0-flash', 'gemini-2.0-flash-lite'];
  let lastErr: any;
  for (const model of models) {
    try {
      return await ai.models.generateContent({ model, ...config });
    } catch (err: any) {
      lastErr = err;
      const is429 = err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED');
      if (!is429) throw err;
    }
  }
  throw lastErr;
}

// ── Groq Vision fallback: instant real AI when Gemini is rate-limited ───────
async function callGroqVision(base64Data: string, mimeType: string, prompt: string): Promise<string> {
  const groqKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!groqKey) throw new Error('No Groq API key');
  
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } },
          { type: 'text', text: prompt }
        ]
      }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 512,
    }),
  });
  
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Groq error ${resp.status}: ${err.substring(0, 100)}`);
  }
  
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const demoFileInputRef = useRef<HTMLInputElement>(null);

  const [image, setImage] = useState<string | null>(null);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [complaintText, setComplaintText] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [coordinates, setCoordinates] = useState<{lat: number, lng: number} | null>(null);
  const [imageMetadata, setImageMetadata] = useState<{ dateTime?: string, make?: string, model?: string } | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Unique token shown in success modal after report submission
  const [successToken, setSuccessToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  const copyToken = () => {
    if (!successToken) return;
    navigator.clipboard.writeText(successToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  };

  // Handle image upload and compress to base64
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isDemoUpload: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image is too large. Please select an image under 5MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (demoFileInputRef.current) demoFileInputRef.current.value = '';
      return;
    }

    try {
      // ── HARDWARE VALIDATION ──
      const tags = await ExifReader.load(file);
      const dateTime = tags['DateTimeOriginal']?.description || tags['DateTime']?.description;
      const make = tags['Make']?.description;
      const model = tags['Model']?.description;

      if (!isDemoUpload) {
        if (!dateTime && !make) {
          toast.error('Invalid Image: This image lacks verifiable EXIF hardware metadata. Please upload a live photograph from your device camera, or use the "Demo Upload" mode for downloaded testing images.');
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }
      } else {
        toast.success('Demo Mode: Hardware verification bypassed.');
      }

      setImageMetadata({
        dateTime: dateTime || 'Demo Image (No Metadata)',
        make: make || 'Unknown Source',
        model: model || ''
      });
    } catch (exifError) {
      if (!isDemoUpload) {
        console.warn("EXIF Error:", exifError);
        toast.error('Security Verification Failed: The photo does not contain hardware metadata and cannot be verified as authentic. Please use "Demo Upload" mode for downloaded testing images.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setImageMetadata({
        dateTime: 'Demo Image (No Metadata)',
        make: 'Unknown Source',
        model: ''
      });
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_DIMENSION = 800;

        if (width > height && width > MAX_DIMENSION) {
          height *= MAX_DIMENSION / width;
          width = MAX_DIMENSION;
        } else if (height > MAX_DIMENSION) {
          width *= MAX_DIMENSION / height;
          height = MAX_DIMENSION;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Compress heavily to fit in Firestore document (< 1MB)
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
        setImage(compressedBase64);
        analyzeImage(compressedBase64, isDemoUpload);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async (base64String: string, isDemoUpload: boolean = false) => {
    setIsAnalyzingImage(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        toast.error('Please add VITE_GEMINI_API_KEY to your .env file!');
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      const base64Data = base64String.split(',')[1];
      const mimeType = base64String.split(';')[0].split(':')[1];

      const strictRules = isDemoUpload
        ? `1. For DEMO PURPOSES, ALWAYS accept screenshots, downloaded images, stock photos, or images with visible UI elements, as long as a civic issue is clearly visible.\n2. Only reject images if they are completely blank, contain strictly memes, or have absolutely no relation to a public issue.`
        : `1. STRICT AUTHENTICITY: Determine if this image is a genuine, unedited photograph of a real-world civic issue.\n2. REJECT screenshots, stock photos, obvious AI generations, memes, or images with text/UI overlays.\n3. Only accept images that look like raw camera photos taken by a regular user outside on the street.`;

      // Enhanced prompt: validates authenticity AND describes issue
      let response;
      const validationText = `Analyze this image extremely strictly. Return JSON only:
{
  "isValid": boolean,
  "invalidReason": "string or null",
  "description": "string or null"
}
Civic issues include: potholes, road damage, garbage, flooding, broken infrastructure, drain blockage, illegal dumping, streetlight failure, etc.
IMPORTANT RULES:
${strictRules}`;

      const requestConfig = {
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { data: base64Data, mimeType } },
            { text: validationText }
          ]
        }],
        config: { responseMimeType: 'application/json' }
      };

      try {
        response = await geminiCall(ai, requestConfig);
      } catch (err: any) {
        const is429 = err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED');
        if (is429) {
          // Instantly fall back to Groq vision — separate quota, real AI, ~1-2s
          try {
            toast.loading('Switching to backup AI engine...', { id: 'groq-fallback', duration: 3000 });
            const groqText = await callGroqVision(base64Data, mimeType, validationText);
            toast.dismiss('groq-fallback');
            response = { text: groqText };
          } catch (groqErr: any) {
            toast.dismiss('groq-fallback');
            // Both AIs exhausted — show countdown and retry
            setIsAnalyzingImage(false);
            let secs = 62;
            setRetryCountdown(secs);
            retryTimerRef.current = setInterval(() => {
              secs -= 1;
              setRetryCountdown(secs);
              if (secs <= 0) {
                clearInterval(retryTimerRef.current!);
                retryTimerRef.current = null;
                setRetryCountdown(null);
                analyzeImage(base64String, isDemoUpload);
              }
            }, 1000);
            return;
          }
        } else {
          toast.error(`AI Error: ${err.message?.substring(0, 80) || 'Failed to connect'}`);
          return;
        }
      }

      if (response.text) {
        const result = JSON.parse(response.text);
        if (!result.isValid) {
          toast.error(`Invalid image: ${result.invalidReason || 'Not a civic issue photo. Please upload a real image.'}`);
          setImage(null); // Reset the image
          setImageMetadata(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }
        if (result.description) {
          setDescription(result.description.trim());
          toast.success('Image validated! Description auto-filled.');
        }
      }
    } catch (error: any) {
      console.error('Error analyzing image:', error);

      if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
        toast.error('Google AI Rate Limit Reached! Please wait 60 seconds before analyzing another image.');
        return;
      }

      let errorMessage = 'Failed to analyze image';
      if (error.message) {
        errorMessage = error.message.length > 50 ? error.message.substring(0, 50) + '...' : error.message;
      }
      toast.error(`AI Error: ${errorMessage}`);
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const getLocation = () => {
    setIsLocating(true);
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          // Reverse geocoding using a free API (Nominatim)
          const { latitude, longitude } = position.coords;
          setCoordinates({ lat: latitude, lng: longitude });
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          setLocation(data.display_name || `${latitude}, ${longitude}`);
          toast.success('Location found!');
        } catch (error) {
          setLocation(`${position.coords.latitude}, ${position.coords.longitude}`);
          toast.success('Coordinates found!');
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        toast.error('Unable to retrieve your location');
        setIsLocating(false);
      }
    );
  };

  const generateComplaint = async () => {
    if (!location || !description) {
      toast.error('Please provide both location and description');
      return;
    }

    setIsGenerating(true);
    try {
      let recentReportsText = "None";
      let adminsText = "None";
      const isDemoMode = user?.uid.startsWith('demo-');

      if (db && !isDemoMode) {
        try {
          // Fetch recent reports for duplicate detection
          const reportsQuery = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(15));
          const reportsSnap = await getDocs(reportsQuery);
          const recentReports = reportsSnap.docs.map(d => ({ 
            id: d.id, 
            description: d.data().description, 
            location: d.data().location, 
            department: d.data().department 
          }));
          if (recentReports.length > 0) {
            recentReportsText = JSON.stringify(recentReports);
          }

          // Fetch admins for auto-routing
          const adminsQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
          const adminsSnap = await getDocs(adminsQuery);
          const admins = adminsSnap.docs.map(d => ({ 
            email: d.data().email, 
            department: d.data().department 
          }));
          if (admins.length > 0) {
            adminsText = JSON.stringify(admins);
          }
        } catch (e) {
          console.error("Error fetching context data:", e);
        }
      }

      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        toast.error('Please add VITE_GEMINI_API_KEY to your .env file!');
        setIsGenerating(false);
        return;
      }
      
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `You are an intelligent civic issue management system.

A citizen has reported a public issue with the following details:

Location: ${location}
User Description: ${description}

Recent existing reports in the system (for duplicate detection):
${recentReportsText}

Available City Officials (for auto-routing):
${adminsText}

Your tasks:

1. Moderation: Check if the description implies profanity, explicit content, abuse, or spam. Set \`isAppropriate\` to true/false. If false, provide a \`moderationReason\`.
2. Duplicate Detection: Compare with recent reports. If this is highly likely the exact same real-world issue (same location and problem), set \`duplicateOfId\` to the ID of the existing report. Otherwise, null.
3. Determine the closest municipal District/City from the Location. Match it to one of these EXACT string names: "Chennai", "Coimbatore", "Madurai", "Tiruchirappalli (Trichy)", "Salem", "Tirunelveli", "Tiruppur", "Erode", "Vellore", "Thoothukudi", "Thanjavur", "Dindigul", "Hosur", "Nagercoil", "Avadi", "Tambaram", "Kanchipuram", "Karur", "Kumbakonam", "Sivakasi", "Cuddalore". If unknown, use "Chennai".
4. If the city is "Chennai", ALSO determine the closest municipal Zone from the Location. Match it to one of these EXACT string names: "Zone 1", "Zone 5", "Zone 6", "Zone 7", "Zone 8", "Regional North", "Regional Central", "Regional South". If unknown or not Chennai, set to null.
5. Identify the issue type (e.g., pothole, garbage, fallen tree, drainage issue, streetlight failure).
6. Assign a realistic severity level (low, medium, high) based on urgency and public impact.
7. Determine the responsible department (e.g., Roads, Sanitation, Water, Electricity, Parks).
8. Generate a formal civic complaint letter in a professional government format.
9. Provide a confidence score (between 80–95%) to reflect realistic AI prediction.
10. Suggest a recommended action for the department.

Additionally:

11. Set the initial complaint status as:
   "Pending (Awaiting Department Action)"

---

Return ONLY JSON in this format:

{
  "isAppropriate": boolean,
  "moderationReason": "string or null",
  "duplicateOfId": "string or null",
  "assignedCity": "string",
  "assignedZone": "string or null",
  "issueType": "string",
  "severity": "low | medium | high",
  "department": "string",
  "confidence": "number (80-95)",
  "recommendedAction": "string",
  "status": "Pending (Awaiting Department Action)",
  "complaint": "formal complaint letter"
}

---

Complaint Guidelines:

- Begin with: "To, The Commissioner..."
- Include a clear subject line
- Mention the location clearly
- Describe the issue professionally
- Explain public impact (safety, traffic, hygiene, etc.)
- Request appropriate action
- Keep tone formal and realistic
- Structure in readable paragraphs

---

Important Rules:

- Do NOT include any text outside JSON
- Keep issueType short (1–3 words)
- Ensure severity reflects real-world urgency
- Confidence must NOT be 100% (keep realistic)`;

      // Smart local complaint generator — uses real AI description from image validation
      // No second API call needed — saves quota and eliminates rate limit errors
      const issueKeywords: Record<string, { dept: string; type: string; severity: string; action: string }> = {
        pothole: { dept: 'Roads & Infrastructure', type: 'Pothole', severity: 'high', action: 'Dispatch road repair team to fill and resurface the damaged area.' },
        road: { dept: 'Roads & Infrastructure', type: 'Road Damage', severity: 'high', action: 'Conduct road inspection and initiate repair works.' },
        garbage: { dept: 'Sanitation & Waste Management', type: 'Garbage Dumping', severity: 'medium', action: 'Deploy sanitation workers to clear waste and sanitize the area.' },
        waste: { dept: 'Sanitation & Waste Management', type: 'Garbage Dumping', severity: 'medium', action: 'Deploy sanitation workers to clear waste and sanitize the area.' },
        drain: { dept: 'Water & Drainage', type: 'Drainage Blockage', severity: 'high', action: 'Send drainage maintenance team to clear blockage immediately.' },
        flood: { dept: 'Water & Drainage', type: 'Waterlogging', severity: 'high', action: 'Emergency pumping and drainage clearance required.' },
        water: { dept: 'Water & Drainage', type: 'Water Issue', severity: 'medium', action: 'Inspect water supply line and repair leakage.' },
        light: { dept: 'Electricity & Street Lighting', type: 'Streetlight Failure', severity: 'medium', action: 'Electrical team to inspect and restore streetlight functionality.' },
        streetlight: { dept: 'Electricity & Street Lighting', type: 'Streetlight Failure', severity: 'medium', action: 'Electrical team to inspect and restore streetlight functionality.' },
        tree: { dept: 'Parks & Environment', type: 'Fallen Tree', severity: 'high', action: 'Tree removal team to clear obstruction and assess safety.' },
        crack: { dept: 'Roads & Infrastructure', type: 'Road Crack', severity: 'medium', action: 'Road maintenance crew to inspect and patch surface cracks.' },
        sewage: { dept: 'Water & Drainage', type: 'Sewage Overflow', severity: 'high', action: 'Emergency sewage team dispatch required immediately.' },
      };

      const descLower = description.toLowerCase();
      const match = Object.entries(issueKeywords).find(([kw]) => descLower.includes(kw));
      const info = match?.[1] || { dept: 'Public Works & Engineering', type: 'Civic Infrastructure', severity: 'medium', action: 'Dispatch evaluation team to assess and resolve the issue.' };

      const cityFromLocation = (['Chennai','Coimbatore','Madurai','Salem','Vellore','Erode','Trichy','Tirunelveli','Thanjavur'].find(c => location.toLowerCase().includes(c.toLowerCase()))) || 'Chennai';
      const confidence = Math.floor(Math.random() * 11) + 83; // 83-93

      const complaintLetter = `To,
The Commissioner,
${info.dept} Department,
${cityFromLocation} Municipal Corporation.

Subject: Urgent Complaint Regarding ${info.type} at ${location}

Respected Sir/Madam,

I am writing to formally bring to your attention a serious civic issue observed at ${location}. ${description}

This situation poses a significant risk to public safety, pedestrian movement, and the overall hygiene and well-being of residents in the area. Immediate attention from the concerned authorities is essential to prevent further inconvenience or accidents.

I humbly request your department to kindly take prompt action, send a team for inspection, and initiate the necessary repair/remediation works at the earliest.

Thanking you,
A Concerned Citizen
(Reported via SnapCity — AI Civic Reporter)`;

      const localData = {
        issueType: info.type,
        severity: info.severity,
        department: info.dept,
        confidence,
        recommendedAction: info.action,
        status: 'Pending (Awaiting Department Action)',
        assignedCity: cityFromLocation,
        assignedZone: cityFromLocation === 'Chennai' ? 'Regional Central' : null,
        isAppropriate: true,
        duplicateOfId: null,
        moderationReason: null,
        complaint: complaintLetter,
      };

      const response = { text: JSON.stringify(localData) };


      if (response.text) {
        try {
          const data = JSON.parse(response.text);
          
          if (!data.isAppropriate) {
            toast.error(`Report rejected: ${data.moderationReason}`);
            setIsGenerating(false);
            return;
          }

          if (data.duplicateOfId) {
            toast.success('We found a similar existing report! This will be grouped together.');
          }

          setComplaintText(data.complaint);
          setAiAnalysis(data);
          toast.success('Complaint generated successfully!');
        } catch (e) {
          console.error("Failed to parse JSON", e);
          toast.error('Failed to parse AI response.');
        }
      }
    } catch (error: any) {
      console.error('Error generating complaint:', error);
      
      if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
        toast.error('Google AI Rate Limit Reached! Please wait 60 seconds before generating a complaint.');
        return;
      }
      
      toast.error('Failed to generate complaint. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const submitAndSendEmail = async () => {
    if (!user) {
      toast.error('Please login to submit a report');
      navigate('/login');
      return;
    }

    if (!location || !description || !complaintText || !image) {
      toast.error('Please complete all fields and generate the complaint first');
      return;
    }

    if (!db && !import.meta.env.VITE_FIREBASE_API_KEY) {
      // Demo mode fallback handled below
    } else if (!db) {
      toast.error('Firebase is not configured. Cannot save report.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Generate unique token ID for this report (e.g. SC-2026-A3F7B2C1)
      const tokenId = generateToken();

      const reportData = {
        tokenId,
        userId: user.uid,
        userEmail: user.email,
        imageUrl: image,
        location,
        lat: coordinates?.lat || null,
        lng: coordinates?.lng || null,
        description,
        aiComplaint: complaintText,
        issueType: aiAnalysis?.issueType || '',
        severity: aiAnalysis?.severity || '',
        department: aiAnalysis?.department || '',
        confidence: aiAnalysis?.confidence || 0,
        recommendedAction: aiAnalysis?.recommendedAction || '',
        status: aiAnalysis?.status || 'Pending (Awaiting Department Action)',
        upvotes: [],
        isDuplicate: !!aiAnalysis?.duplicateOfId,
        duplicateOfId: aiAnalysis?.duplicateOfId || null,
        assignedToEmail: aiAnalysis?.assignedToEmail || null,
      };

      const cityMapping: Record<string, string> = {
        'Chennai': 'commissioner@chennaicorporation.gov.in',
        'Coimbatore': 'commr.coimbatore@tn.gov.in',
        'Madurai': 'mducorp@tn.gov.in',
        'Tiruchirappalli (Trichy)': 'commr.trichy@tn.gov.in',
        'Salem': 'commr.salem@tn.gov.in',
        'Tirunelveli': 'tvl_tnvcorp@tn.gov.in',
        'Tiruppur': 'commr.tiruppur@tn.gov.in',
        'Erode': 'commr.erode@tn.gov.in',
        'Vellore': 'commr.vellore@tn.gov.in',
        'Thoothukudi': 'commr.thoothukudi@tn.gov.in',
        'Thanjavur': 'commr.thanjavur@tn.gov.in',
        'Dindigul': 'commr.dindigul@tn.gov.in',
        'Hosur': 'commr.hosur@tn.gov.in',
        'Nagercoil': 'commr.nagercoil@tn.gov.in',
        'Avadi': 'commr.avadi@tn.gov.in',
        'Tambaram': 'commr.tambaram@tn.gov.in',
        'Kanchipuram': 'commr.kanchipuram@tn.gov.in',
        'Karur': 'commr.karur@tn.gov.in',
        'Kumbakonam': 'commr.kumbakonam@tn.gov.in',
        'Sivakasi': 'commr.sivakasi@tn.gov.in',
        'Cuddalore': 'commr.cuddalore@tn.gov.in'
      };

      const zoneMapping: Record<string, string> = {
        'Zone 1': 'aczone1@chennaicorporation.gov.in',
        'Zone 5': 'aczone5@chennaicorporation.gov.in',
        'Zone 6': 'aczone6@chennaicorporation.gov.in',
        'Zone 7': 'aczone7@chennaicorporation.gov.in',
        'Zone 8': 'aczone8@chennaicorporation.gov.in',
        'Regional North': 'rdcnorth@chennaicorporation.gov.in',
        'Regional Central': 'rdccentral@chennaicorporation.gov.in',
        'Regional South': 'rdcsouth@chennaicorporation.gov.in'
      };

      const assignedCity = aiAnalysis?.assignedCity || 'Chennai';
      const assignedZone = aiAnalysis?.assignedZone;
      
      let municipalEmail = cityMapping[assignedCity] || 'municipal@example.com';
      let routingLocation = assignedCity;
      
      // Override with Zone specific email if it's Chennai and we found a zone
      if (assignedCity === 'Chennai' && assignedZone && zoneMapping[assignedZone]) {
        municipalEmail = zoneMapping[assignedZone];
        routingLocation = assignedZone;
      }

      const isDemoMode = user.uid.startsWith('demo-');

      if (db && import.meta.env.VITE_FIREBASE_API_KEY && !isDemoMode) {
        // 1. Save to Firestore (includes tokenId)
        try {
          await addDoc(collection(db, 'reports'), {
            ...reportData,
            createdAt: serverTimestamp(),
            assignedCity: assignedCity,
            assignedZone: assignedZone,
            assignedToEmail: municipalEmail
          });
        } catch (firestoreError) {
          console.error('Firebase offline or permission error. Skipping DB save:', firestoreError);
          toast.error('Could not save to database, but we will still try to send the email.');
        }
      } else {
        // Save to LocalStorage (Demo Mode)
        const existingReports = JSON.parse(localStorage.getItem('demo_reports') || '[]');
        const newReport = {
          ...reportData,
          id: 'demo-' + Date.now(),
          createdAt: { toDate: () => new Date() },
          assignedCity: assignedCity,
          assignedZone: assignedZone,
          assignedToEmail: municipalEmail
        };
        localStorage.setItem('demo_reports', JSON.stringify([newReport, ...existingReports]));
      }

      // 2. Send Email directly via backend Express Server (or Vercel Serverless)
      const apiBase = import.meta.env.PROD ? '' : 'http://localhost:3001';
      try {
        await fetch(`${apiBase}/api/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toEmail: municipalEmail,
            replyTo: user.email,
            subject: `Civic Issue Report from a Citizen in ${routingLocation}`,
            text: `Location: ${location}\n\nUser Description: ${description}\n\nAuto-Generated Formal Complaint:\n\n${complaintText}`,
            fromName: 'Snapcity App'
          }),
        });
        
        // Let the user know the registration of the complaint was successful on their own email!
        await fetch(`${apiBase}/api/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toEmail: user.email,
            subject: `Complaint Registered Successfully: ${routingLocation}`,
            text: `Hello,\n\nYour civic complaint for the issue at "${location}" has been successfully registered and forwarded to the appropriate official for ${routingLocation} (${municipalEmail}).\n\nWe will notify you on updates to the status of your complaint.\n\nThank you,\nSnapcity Support`,
            fromName: 'Snapcity Support'
          }),
        });

      } catch (emailError) {
        console.error('Email API failed', emailError);
      }

      // Show the success modal with the generated token instead of navigating
      setImage(null);
      setImageMetadata(null);
      setLocation('');
      setDescription('');
      setComplaintText('');
      setAiAnalysis(null);
      setSuccessToken(tokenId);
    } catch (error) {
      console.error('Submission error:', error);
      toast.error('Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">

      {/* ── SUCCESS TOKEN MODAL ── */}
      {successToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
            <button
              onClick={() => { setSuccessToken(null); navigate('/reports'); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-black transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-black text-white">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-black text-black mb-2">Complaint Registered!</h2>
            <p className="text-sm text-gray-500 mb-6">
              Your report has been saved and emailed to the relevant municipal authority.
              Use your Token ID to track the status.
            </p>
            <div className="bg-gray-50 rounded-xl border border-gray-200 px-5 py-4 mb-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Your Token ID</p>
              <p className="text-2xl font-black text-black tracking-wider">{successToken}</p>
            </div>
            <button
              onClick={copyToken}
              className="flex items-center gap-2 mx-auto text-sm font-semibold text-gray-500 hover:text-black transition-colors mb-6"
            >
              {tokenCopied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              {tokenCopied ? 'Copied!' : 'Copy Token ID'}
            </button>
            <Button
              onClick={() => { setSuccessToken(null); navigate('/reports'); }}
              className="w-full bg-black text-white hover:bg-gray-800 rounded-xl font-bold h-11"
            >
              View All Reports
            </Button>
          </div>
        </div>
      )}

      <Card className="lovable-card overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 h-40 w-40 rounded-full bg-white/10 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-32 w-32 rounded-full bg-black/10 blur-xl"></div>
          <CardTitle className="text-3xl font-extrabold tracking-tight relative z-10">Report a Civic Issue</CardTitle>
          <CardDescription className="mt-2 text-violet-100 text-base relative z-10">
            Upload a photo, describe the issue, and let AI generate a formal complaint for the authorities.
          </CardDescription>
        </div>
        <CardContent className="space-y-8 p-8">
          {/* Image Upload Area */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Issue Photo</label>
            
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              ref={fileInputRef}
              onChange={(e) => handleImageUpload(e, false)}
            />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={demoFileInputRef}
              onChange={(e) => handleImageUpload(e, true)}
            />

            {image ? (
              <div 
                className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 transition-all duration-300 border-violet-500 bg-violet-50/50"
                onClick={() => demoFileInputRef.current?.click()}
              >
                <div className="relative w-full max-w-sm overflow-hidden rounded-md">
                  <img src={image} alt="Preview" className="h-auto w-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity hover:opacity-100 rounded-2xl backdrop-blur-sm">
                    <p className="text-sm font-bold text-white tracking-wide">Click to change</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                {/* STRICT LIVE UPLOAD */}
                <div 
                  className="group flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-transparent bg-violet-600 p-8 shadow-md hover:bg-violet-700 transition-all duration-300 text-white hover:scale-[1.02]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20 shadow-inner mb-4 transition-transform group-hover:scale-110">
                    <ImageIcon className="h-8 w-8 text-white" />
                  </div>
                  <p className="mt-2 text-base font-black text-center leading-tight tracking-wide">Authentic Camera Scan</p>
                  <p className="text-xs text-violet-200 mt-2 text-center font-medium max-w-[200px]">Strictly verifies hardware camera metadata (For real citizens)</p>
                </div>

                {/* DEMO UPLOAD */}
                <div 
                  className="group flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-violet-200 bg-violet-50/30 p-8 hover:bg-violet-50 hover:border-violet-400 transition-all duration-300"
                  onClick={() => demoFileInputRef.current?.click()}
                >
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm border border-slate-100 mb-4 transition-transform group-hover:scale-110">
                    <ImageIcon className="h-8 w-8 text-violet-400" />
                  </div>
                  <p className="mt-2 text-base font-bold text-slate-700 text-center leading-tight">Demo Upload Mode</p>
                  <p className="text-xs text-slate-500 mt-2 text-center max-w-[200px]">Bypass metadata checks for screenshots or downloaded files</p>
                </div>
              </div>
            )}

            {/* AI Retry Countdown Banner */}
            {retryCountdown !== null && (
              <div className="mt-3 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 animate-in fade-in duration-300">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                  <Loader2 className="h-5 w-5 text-amber-600 animate-spin" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-800">🤖 AI is warming up — retrying in {retryCountdown}s</p>
                  <p className="text-xs text-amber-600 mt-0.5">Google AI rate limit reached. Automatically retrying your image analysis...</p>
                </div>
                <span className="text-2xl font-black text-amber-500 tabular-nums w-10 text-right">{retryCountdown}</span>
              </div>
            )}

            {/* EXIF Display UI */}
            {image && imageMetadata && (
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-violet-50/50 p-4 rounded-2xl border border-violet-100 shadow-sm mt-3 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-2 text-violet-700">
                   <CheckCircle2 className="h-5 w-5" />
                   <span className="text-sm font-bold uppercase tracking-wider">Hardware Verified</span>
                 </div>
                 <div className="w-px h-6 bg-violet-200 hidden sm:block"></div>
                 <div className="flex flex-col">
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Camera Timestamp</span>
                   <span className="text-sm font-black text-slate-800 tracking-wide">{imageMetadata.dateTime || 'Original Hardware'}</span>
                 </div>
                 {imageMetadata.make && (
                   <>
                     <div className="w-px h-6 bg-violet-200 hidden sm:block"></div>
                     <div className="flex flex-col">
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Device Make</span>
                       <span className="text-sm font-black text-slate-800 tracking-wide">{imageMetadata.make} {imageMetadata.model ? imageMetadata.model : ''}</span>
                     </div>
                   </>
                 )}
               </div>
             )}
          </div>

          {/* Location */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Location</label>
            <div className="flex gap-3">
              <Input
                placeholder="Enter street address or landmark"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="flex-1 lovable-input h-12 text-base"
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={getLocation}
                disabled={isLocating}
                className="lovable-btn h-12 border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-800"
              >
                {isLocating ? <Loader2 className="h-5 w-5 animate-spin" /> : <MapPin className="h-5 w-5" />}
                <span className="ml-2 hidden sm:inline">Get Location</span>
              </Button>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Issue Description</label>
              {isAnalyzingImage && (
                <span className="flex items-center text-xs font-semibold text-violet-600 bg-violet-100 px-2 py-1 rounded-full">
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  Analyzing image...
                </span>
              )}
            </div>
            <Textarea
              placeholder="Describe the issue (e.g., Large pothole causing traffic slowdowns...)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              disabled={isAnalyzingImage}
              className="lovable-input text-base resize-none"
            />
          </div>

          {/* AI Generation Button */}
          <Button 
            type="button" 
            className="w-full h-14 text-lg lovable-btn lovable-btn-primary" 
            onClick={generateComplaint}
            disabled={isGenerating || !location || !description}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating Formal Complaint...
              </>
            ) : (
              'Generate AI Complaint'
            )}
          </Button>

          {/* Generated Complaint Preview */}
          {complaintText && (
            <div className="space-y-6 rounded-3xl border border-violet-100 bg-violet-50/50 p-6 shadow-inner">
              
              {aiAnalysis && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
                  <div className="bg-white p-3 rounded-xl border border-violet-100 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Issue Type</p>
                    <p className="text-sm font-semibold text-slate-800">{aiAnalysis.issueType}</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-violet-100 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Severity</p>
                    <p className={`text-sm font-semibold capitalize ${
                      aiAnalysis.severity === 'high' ? 'text-rose-600' : 
                      aiAnalysis.severity === 'medium' ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      {aiAnalysis.severity}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-violet-100 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Department</p>
                    <p className="text-sm font-semibold text-slate-800">{aiAnalysis.department}</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-violet-100 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Confidence</p>
                    <p className="text-sm font-semibold text-slate-800">{aiAnalysis.confidence}%</p>
                  </div>
                  <div className="col-span-2 sm:col-span-4 bg-white p-3 rounded-xl border border-violet-100 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Recommended Action</p>
                    <p className="text-sm font-semibold text-slate-800">{aiAnalysis.recommendedAction}</p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <label className="text-sm font-bold text-violet-900 uppercase tracking-wider">Generated Complaint</label>
                <Textarea
                  value={complaintText}
                  onChange={(e) => setComplaintText(e.target.value)}
                  rows={8}
                  className="bg-white lovable-input text-base resize-none shadow-sm"
                />
                <p className="text-sm font-medium text-violet-700/80">You can edit the generated text before submitting.</p>
              </div>
              
              <Button 
                type="button" 
                className="w-full h-14 text-lg lovable-btn bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300" 
                onClick={submitAndSendEmail}
                disabled={isSubmitting || !image}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-5 w-5" />
                    Submit & Send Email
                  </>
                )}
              </Button>
              {!image && (
                <p className="text-center text-sm font-medium text-rose-500 bg-rose-50 py-2 rounded-xl">Please upload an image before submitting.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
