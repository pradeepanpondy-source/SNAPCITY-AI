import React, { useEffect, useState, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Loader2, MapPin, Clock3, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

// Fix Leaflet's default icon path issues with Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface Report {
  id: string;
  userId: string;
  userEmail: string;
  imageUrl: string;
  location: string;
  lat?: number | null;
  lng?: number | null;
  description: string;
  status: string;
  issueType?: string;
  severity?: string;
  createdAt: any;
}

function ReportMarker({ report, isLatest }: { report: Report & { lat: number, lng: number }, isLatest: boolean }) {
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
    if (isLatest && markerRef.current) {
      setTimeout(() => {
        markerRef.current?.openPopup();
      }, 500);
    }
  }, [isLatest]);

  const isCompleted = report.status.toLowerCase().includes('completed') || report.status.toLowerCase().includes('resolved');

  return (
    <Marker position={[report.lat, report.lng]} ref={markerRef}>
      <Popup>
        <div className="w-60 flex flex-col font-sans">
          {report.imageUrl && (
            <div className="h-32 w-full overflow-hidden rounded-t-lg mb-2">
              <img 
                src={report.imageUrl} 
                alt="Issue" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {isCompleted ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" /> {report.status}
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                  <Clock3 className="h-3 w-3" /> {report.status}
                </span>
              )}
              {report.issueType && (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                  {report.issueType}
                </span>
              )}
            </div>
            
            <h3 className="font-bold text-slate-800 text-sm leading-tight line-clamp-2">
              {report.description}
            </h3>
            
            <div className="flex items-start gap-1.5 text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{report.location}</span>
            </div>
            
            <div className="text-[10px] font-medium text-slate-400 border-t border-slate-100 pt-2 mt-1">
              Reported on {report.createdAt?.toDate ? format(report.createdAt.toDate(), 'MMM d, yyyy') : 'Recently'}
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

export default function IssueMap() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isDemoMode = user?.uid.startsWith('demo-');

    if (!db || !import.meta.env.VITE_FIREBASE_API_KEY || isDemoMode) {
      // Demo Mode Fallback
      const localReports = JSON.parse(localStorage.getItem('demo_reports') || '[]');
      const formattedReports = localReports.map((r: any) => ({
        ...r,
        createdAt: { toDate: () => new Date(parseInt(r.id.split('-')[1]) || Date.now()) }
      }));
      setReports(formattedReports);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const reportsData: Report[] = [];
        snapshot.forEach((doc) => {
          reportsData.push({ id: doc.id, ...doc.data() } as Report);
        });
        setReports(reportsData);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching reports:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-5rem)] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
      </div>
    );
  }

  // Process reports to ensure they have valid coordinates
  const mapReports = reports.map(report => {
    let lat = report.lat;
    let lng = report.lng;

    // Try to parse from location string if lat/lng are missing
    if (lat == null || lng == null) {
      const parts = report.location.split(',');
      if (parts.length === 2) {
        const parsedLat = parseFloat(parts[0].trim());
        const parsedLng = parseFloat(parts[1].trim());
        if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
          lat = parsedLat;
          lng = parsedLng;
        }
      }
    }

    return { ...report, lat, lng };
  }).filter(r => r.lat != null && r.lng != null) as (Report & { lat: number, lng: number })[];

  // Default center (e.g., center of the first report, or a default city if none)
  const defaultCenter: [number, number] = mapReports.length > 0 
    ? [mapReports[0].lat, mapReports[0].lng] 
    : [37.7749, -122.4194]; // San Francisco as fallback

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 h-[calc(100vh-5rem)] flex flex-col">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
          Issue Map
        </h1>
        <p className="mt-2 text-slate-600">
          Explore reported civic issues in your community.
        </p>
      </div>

      <div className="flex-1 rounded-2xl overflow-hidden border border-slate-200 shadow-lg relative z-0">
        <MapContainer 
          center={defaultCenter} 
          zoom={12} 
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {mapReports.map((report, index) => (
            <ReportMarker key={report.id} report={report} isLatest={index === 0} />
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
