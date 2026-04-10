import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Clock, CheckCircle2, Clock3, FileText, ImageIcon, ThumbsUp, Share2, AlertCircle, MessageSquare, Trash2, Search } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';

interface Report {
  id: string;
  tokenId?: string;
  userId: string;
  userEmail: string;
  imageUrl: string;
  location: string;
  description: string;
  aiComplaint: string;
  status: string;
  createdAt: any;
  upvotes?: string[];
  adminFeedback?: string;
  assignedToEmail?: string;
  isDuplicate?: boolean;
}

export default function Reports() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const isDemoMode = user?.uid.startsWith('demo-');

    if (!db || !import.meta.env.VITE_FIREBASE_API_KEY || isDemoMode) {
      // Demo Mode Fallback
      const localReports = JSON.parse(localStorage.getItem('demo_reports') || '[]');
      // Fix the mock date object since JSON.stringify strips the toDate function
      const formattedReports = localReports.map((r: any) => ({
        ...r,
        createdAt: { toDate: () => new Date(parseInt(r.id.split('-')[1])) }
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
        toast.error('Failed to load reports');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const isDemoMode = user?.uid.startsWith('demo-');

  const handleUpvote = async (reportId: string, currentUpvotes: string[] = []) => {
    if (!user) {
      toast.error('Please login to upvote');
      return;
    }

    const hasUpvoted = currentUpvotes.includes(user.uid);
    
    if (db && import.meta.env.VITE_FIREBASE_API_KEY && !isDemoMode) {
      try {
        const reportRef = doc(db, 'reports', reportId);
        await updateDoc(reportRef, {
          upvotes: hasUpvoted ? arrayRemove(user.uid) : arrayUnion(user.uid)
        });
      } catch (error) {
        console.error('Error upvoting:', error);
        toast.error('Failed to upvote');
      }
    } else {
      // Demo mode
      const localReports = JSON.parse(localStorage.getItem('demo_reports') || '[]');
      const updatedReports = localReports.map((r: any) => {
        if (r.id === reportId) {
          const upvotes = r.upvotes || [];
          return {
            ...r,
            upvotes: hasUpvoted ? upvotes.filter((id: string) => id !== user.uid) : [...upvotes, user.uid]
          };
        }
        return r;
      });
      localStorage.setItem('demo_reports', JSON.stringify(updatedReports));
      setReports(updatedReports);
    }
  };

  const handleShare = async (report: Report) => {
    try {
      const shareText = `Civic Issue Reported: ${report.description}\nLocation: ${report.location}\nStatus: ${report.status}`;
      await navigator.clipboard.writeText(shareText);
      toast.success('Report details copied to clipboard!');
    } catch (error) {
      console.error('Error sharing:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleDelete = async (reportId: string) => {
    if (db && import.meta.env.VITE_FIREBASE_API_KEY && !isDemoMode) {
      try {
        await deleteDoc(doc(db, 'reports', reportId));
        toast.success('Report deleted successfully');
      } catch (error) {
        console.error('Error deleting report:', error);
        toast.error('Failed to delete report');
      }
    } else {
      // Demo mode
      const localReports = JSON.parse(localStorage.getItem('demo_reports') || '[]');
      const updatedReports = localReports.filter((r: any) => r.id !== reportId);
      localStorage.setItem('demo_reports', JSON.stringify(updatedReports));
      setReports(updatedReports);
      toast.success('Report deleted successfully (Demo)');
    }
    setConfirmDeleteId(null);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-800 border-t-transparent"></div>
      </div>
    );
  }

  if (!db && import.meta.env.VITE_FIREBASE_API_KEY && !isDemoMode) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-yellow-50 p-4 text-yellow-800">
          <h3 className="text-lg font-medium">Firebase Not Configured</h3>
          <p className="mt-2">Please configure your Firebase environment variables to view reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent sm:text-5xl">Civic Reports</h1>
        <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
          View all submitted civic issues and their current status.
        </p>
      </div>

      <div className="mb-10 max-w-xl mx-auto">
        <div className="relative flex items-center">
          <Search className="absolute left-4 text-slate-400 h-5 w-5" />
          <Input 
            type="text"
            placeholder="Track your Token ID (e.g. SC-2026-...) or search descriptions"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-14 w-full rounded-full border-2 border-violet-100 bg-white/70 backdrop-blur-sm focus-visible:ring-violet-500 shadow-sm text-base"
          />
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-violet-200 bg-white/50 py-24 text-center backdrop-blur-sm shadow-sm">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-violet-100 mb-6">
            <FileText className="h-10 w-10 text-violet-500" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">No reports found</h3>
          <p className="mt-2 text-slate-500 max-w-sm">Be the first to report a civic issue in your area.</p>
        </div>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {reports.filter(report => {
            if (!searchQuery.trim()) return true;
            const query = searchQuery.toLowerCase().trim();
            return report.tokenId?.toLowerCase().includes(query) || report.description.toLowerCase().includes(query) || report.location.toLowerCase().includes(query);
          }).map((report) => {
            const isCompleted = report.status.toLowerCase().includes('completed') || report.status.toLowerCase().includes('resolved');
            const upvotes = report.upvotes || [];
            const hasUpvoted = user ? upvotes.includes(user.uid) : false;
            
            return (
            <Card key={report.id} className="lovable-card overflow-hidden flex flex-col hover:-translate-y-1">
              <div className="relative h-56 w-full bg-slate-100 overflow-hidden">
                {report.imageUrl ? (
                  <img 
                    src={report.imageUrl} 
                    alt="Issue" 
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400 bg-slate-100">
                    <ImageIcon className="h-10 w-10 opacity-50" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
                  {report.isDuplicate && (
                    <span className="flex items-center gap-1.5 rounded-full bg-violet-600/90 backdrop-blur-md px-3 py-1.5 text-xs font-bold text-white shadow-sm">
                      Duplicate
                    </span>
                  )}
                  {isCompleted ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/90 backdrop-blur-md px-3 py-1.5 text-xs font-bold text-white shadow-sm">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {report.status}
                    </span>
                  ) : report.status.toLowerCase().includes('progress') ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-slate-800/90 backdrop-blur-md px-3 py-1.5 text-xs font-bold text-white shadow-sm">
                      <Clock className="h-3.5 w-3.5" /> {report.status}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 rounded-full bg-amber-500/90 backdrop-blur-md px-3 py-1.5 text-xs font-bold text-white shadow-sm">
                      <Clock3 className="h-3.5 w-3.5" /> {report.status}
                    </span>
                  )}
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white/90 backdrop-blur-md bg-black/30 px-2.5 py-1 rounded-lg">
                    <Clock className="h-3.5 w-3.5" />
                    {report.createdAt?.toDate ? format(report.createdAt.toDate(), 'MMM d, yyyy') : 'Recently'}
                  </span>
                </div>
              </div>
              
              <CardHeader className="pb-3 pt-5">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 text-sm text-violet-600 bg-violet-50 p-2.5 rounded-xl w-fit">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span className="line-clamp-1 font-semibold">{report.location}</span>
                  </div>
                  {/* Unique Token ID Badge */}
                  {(report as any).tokenId && (
                    <span className="text-[10px] font-bold font-mono text-gray-500 bg-gray-100 border border-gray-200 rounded-lg px-2 py-1 shrink-0">
                      {(report as any).tokenId}
                    </span>
                  )}
                </div>
                <CardTitle className="line-clamp-2 text-lg font-bold text-slate-800 leading-snug">{report.description}</CardTitle>
                {report.assignedToEmail && (
                  <div className="mt-2 text-xs font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 inline-block">
                    Assigned to: <span className="text-slate-700">{report.assignedToEmail}</span>
                  </div>
                )}
              </CardHeader>
              
              <CardContent className="flex-1 pb-5">
                <div className="mt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">AI Complaint Snippet</h4>
                  <p className="line-clamp-3 text-sm italic text-slate-600 bg-slate-50/80 p-3 rounded-2xl border border-slate-100 relative">
                    <span className="absolute -top-2 -left-1 text-2xl text-violet-200 font-serif">"</span>
                    {report.aiComplaint}
                    <span className="absolute -bottom-4 -right-1 text-2xl text-violet-200 font-serif">"</span>
                  </p>
                </div>
                
                {report.adminFeedback && (
                  <div className={`mt-4 rounded-xl p-3 border ${isCompleted ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <MessageSquare className={`h-3.5 w-3.5 ${isCompleted ? 'text-emerald-600' : 'text-slate-800'}`} />
                      <span className={`text-xs font-bold uppercase tracking-wider ${isCompleted ? 'text-emerald-800' : 'text-slate-800'}`}>
                        Department Response
                      </span>
                    </div>
                    <p className={`text-sm ${isCompleted ? 'text-emerald-700' : 'text-slate-800'}`}>
                      {report.adminFeedback}
                    </p>
                  </div>
                )}
              </CardContent>
              
              <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-200 to-fuchsia-200 flex items-center justify-center text-violet-700 font-bold text-xs">
                      {report.userEmail.charAt(0).toUpperCase()}
                    </div>
                    <p className="text-xs font-medium text-slate-500 truncate">Reported by <span className="text-slate-700">{report.userEmail.split('@')[0]}</span></p>
                  </div>
                  <div className="flex items-center gap-2">
                    {confirmDeleteId === report.id ? (
                      <div className="flex items-center gap-1 bg-rose-50 rounded-lg p-1 border border-rose-100">
                        <Button variant="destructive" size="sm" className="h-6 px-2 text-[10px]" onClick={() => handleDelete(report.id)}>Confirm</Button>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-slate-500 hover:text-slate-700" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setConfirmDeleteId(report.id)}
                        className="h-8 px-2 text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Delete Report"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleUpvote(report.id, report.upvotes)}
                      className={`h-8 px-2 text-xs ${hasUpvoted ? 'text-violet-600 bg-violet-100 hover:bg-violet-200' : 'text-slate-500 hover:text-violet-600 hover:bg-violet-50'}`}
                    >
                      <ThumbsUp className={`mr-1.5 h-3.5 w-3.5 ${hasUpvoted ? 'fill-current' : ''}`} />
                      {upvotes.length}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleShare(report)}
                      className="h-8 px-2 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )})}
        </div>
      )}
    </div>
  );
}
