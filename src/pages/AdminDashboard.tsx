import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  MapPin, Clock3, CheckCircle2, ShieldAlert, AlertCircle,
  Filter, ImageIcon, MessageSquare, Trash2, Sparkles, Loader2,
  Hash, FileText, TrendingUp, AlertTriangle, XCircle, Clock,
  ChevronRight, LogOut, BarChart3
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { GoogleGenAI } from '@google/genai';
import { sendCitizenNotification, sendMunicipalApprovalEmail } from '@/lib/email';

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
  department: string;
  severity: string;
  issueType?: string;
  assignedCity?: string;
  assignedZone?: string;
  assignedToEmail?: string;
  adminFeedback?: string;
  createdAt: any;
  isDuplicate?: boolean;
}

const DEPARTMENTS = ['All', 'Roads', 'Sanitation', 'Water', 'Electricity', 'Parks', 'Other'];
const STATUS_FILTERS = ['All', 'Pending', 'Approved', 'In Progress', 'Denied', 'Resolved'];

// Maps action label → status string stored in Firestore
const STATUS_ACTIONS = [
  { label: 'Pending', value: 'Pending (Awaiting Department Action)', icon: Clock, color: 'amber' },
  { label: 'Approve', value: 'Approved (Forwarded to Municipality)', icon: CheckCircle2, color: 'green' },
  { label: 'In Progress', value: 'In Progress (Department Assigned)', icon: TrendingUp, color: 'blue' },
  { label: 'Deny', value: 'Denied (Admin Rejected)', icon: XCircle, color: 'red' },
  { label: 'Resolved', value: 'Completed (Resolved by Department)', icon: CheckCircle2, color: 'emerald' },
];

const colorMap: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200',
  green: 'bg-green-100 text-green-800 hover:bg-green-200 border-green-200',
  blue: 'bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200',
  red: 'bg-red-100 text-red-800 hover:bg-red-200 border-red-200',
  emerald: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200',
};

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s.includes('resolved') || s.includes('completed'))
    return <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full"><CheckCircle2 className="h-3 w-3" /> Resolved</span>;
  if (s.includes('approved'))
    return <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full"><CheckCircle2 className="h-3 w-3" /> Approved</span>;
  if (s.includes('progress'))
    return <span className="flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full"><TrendingUp className="h-3 w-3" /> In Progress</span>;
  if (s.includes('denied'))
    return <span className="flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"><XCircle className="h-3 w-3" /> Denied</span>;
  return <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"><Clock className="h-3 w-3" /> Pending</span>;
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [generatingFeedback, setGeneratingFeedback] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'reports' | 'stats'>('reports');

  const isDemoMode = user?.uid.startsWith('demo-');

  useEffect(() => {
    if (!db || !import.meta.env.VITE_FIREBASE_API_KEY || isDemoMode) {
      const localReports = JSON.parse(localStorage.getItem('demo_reports') || '[]');
      setReports(localReports.map((r: any) => ({
        ...r,
        createdAt: { toDate: () => new Date(parseInt(r.id?.split('-')[1] || Date.now())) }
      })));
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Report)));
      setLoading(false);
    }, (error) => {
      console.error('Error fetching reports:', error);
      toast.error('Failed to load reports');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, isDemoMode]);

  /**
   * Central status update handler.
   * → Always emails the citizen.
   * → If status is "Approved", also emails the municipal office.
   */
  const handleStatusUpdate = async (report: Report, newStatus: string) => {
    const feedback = feedbacks[report.id] ?? report.adminFeedback ?? '';
    const updateData: any = { status: newStatus };
    if (feedback.trim()) updateData.adminFeedback = feedback.trim();

    // 1. Update Firestore
    if (db && import.meta.env.VITE_FIREBASE_API_KEY && !isDemoMode) {
      try {
        await updateDoc(doc(db, 'reports', report.id), updateData);
      } catch (err) {
        console.error(err);
        toast.error('Failed to update status in database.');
        return;
      }
    } else {
      const local = JSON.parse(localStorage.getItem('demo_reports') || '[]');
      localStorage.setItem('demo_reports', JSON.stringify(
        local.map((r: any) => r.id === report.id ? { ...r, ...updateData } : r)
      ));
      setReports(prev => prev.map(r => r.id === report.id ? { ...r, ...updateData } : r));
    }

    toast.success(`Report ${newStatus.includes('Approved') ? 'Approved ✔' : newStatus.includes('Denied') ? 'Denied ✘' : 'updated'}: ${newStatus.split('(')[0].trim()}`);

    // 2. Email the citizen about their new status
    await sendCitizenNotification(
      report.userEmail,
      report.description,
      newStatus,
      feedback,
      report.tokenId
    );

    // 3. If Approved → forward the formal complaint to the municipal office
    if (newStatus.toLowerCase().includes('approved')) {
      const targetMunicipalEmail = report.assignedToEmail || 'commissioner@chennaicorporation.gov.in';
      await sendMunicipalApprovalEmail(
        targetMunicipalEmail,
        report.userEmail,
        {
          tokenId: report.tokenId,
          description: report.description,
          location: report.location,
          department: report.department,
          severity: report.severity || 'Medium',
          aiComplaint: report.aiComplaint || `A citizen has requested urgent attention to a ${report.department} issue at ${report.location}.`,
          assignedCity: report.assignedCity || 'Chennai',
          assignedZone: report.assignedZone,
        }
      );
      toast.success(`Complaint forwarded to ${targetMunicipalEmail} ✉`);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (db && import.meta.env.VITE_FIREBASE_API_KEY && !isDemoMode) {
      try { await deleteDoc(doc(db, 'reports', reportId)); toast.success('Report deleted'); }
      catch { toast.error('Failed to delete report'); }
    } else {
      const updated = JSON.parse(localStorage.getItem('demo_reports') || '[]').filter((r: any) => r.id !== reportId);
      localStorage.setItem('demo_reports', JSON.stringify(updated));
      setReports(updated);
      toast.success('Report deleted (Demo)');
    }
    setConfirmDeleteId(null);
  };

  const handleGenerateFeedback = async (report: Report) => {
    setGeneratingFeedback(report.id);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) { toast.error('Add VITE_GEMINI_API_KEY to .env!'); setGeneratingFeedback(null); return; }
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `You are a professional city official. Write a 1-2 sentence professional and empathetic response to a citizen's civic complaint.
Issue: ${report.description || 'Unspecified'}
Location: ${report.location || 'Unspecified'}
Department: ${report.department || 'General'}
Severity: ${report.severity || 'Unknown'}
Do not use placeholders like [City Name].`;

      let res;
      try {
        res = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: prompt });
      } catch (err: any) {
        console.warn('API Error encountered.', err.message);
        res = { text: "Thank you for reporting this issue. Our department has officially documented your complaint, and an assessment team will be dispatched shortly to resolve the situation." };
      }
      
      const text = res.text?.trim() || '';
      if (text) { 
        setFeedbacks(p => ({ ...p, [report.id]: text })); 
        toast.success('AI feedback generated!'); 
      } else {
        toast.error('Failed to generate feedback: Empty response');
      }
    } catch (e: any) { 
      console.error('Feedback Error:', e);
      let errorMessage = 'Failed to connect to Gemini';
      
      if (e.message?.includes('429') || e.message?.includes('quota') || e.message?.includes('RESOURCE_EXHAUSTED')) {
        toast.error('Google AI Rate Limit Reached! Please wait 60 seconds before generating feedback.');
        return;
      } else if (e.message) {
        errorMessage = e.message.length > 50 ? e.message.substring(0, 50) + '...' : e.message;
      }
      
      toast.error(`AI Error: ${errorMessage}`); 
    } finally { 
      setGeneratingFeedback(null); 
    }
  };

  // ── Filtering ──
  const filteredReports = reports.filter(r => {
    const deptOk = selectedDept === 'All' ? true
      : selectedDept === 'Other' ? !DEPARTMENTS.slice(1, -1).includes(r.department)
      : r.department?.toLowerCase().includes(selectedDept.toLowerCase());

    const statusOk = selectedStatus === 'All' ? true
      : selectedStatus === 'Pending' ? r.status.toLowerCase().includes('pending')
      : selectedStatus === 'Approved' ? r.status.toLowerCase().includes('approved')
      : selectedStatus === 'In Progress' ? r.status.toLowerCase().includes('progress')
      : selectedStatus === 'Denied' ? r.status.toLowerCase().includes('denied')
      : r.status.toLowerCase().includes('completed') || r.status.toLowerCase().includes('resolved');

    return deptOk && statusOk;
  });

  // ── Stats ──
  const stats = {
    total: reports.length,
    pending: reports.filter(r => r.status.toLowerCase().includes('pending')).length,
    approved: reports.filter(r => r.status.toLowerCase().includes('approved')).length,
    inProgress: reports.filter(r => r.status.toLowerCase().includes('progress')).length,
    denied: reports.filter(r => r.status.toLowerCase().includes('denied')).length,
    resolved: reports.filter(r => r.status.toLowerCase().includes('completed') || r.status.toLowerCase().includes('resolved')).length,
    highSeverity: reports.filter(r => r.severity?.toLowerCase() === 'high').length,
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-slate-50 text-slate-900">

      {/* ── LEFT SIDEBAR ── */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 py-8 px-5 shrink-0 shadow-sm z-20">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="h-5 w-5 text-rose-500" />
            <span className="text-sm font-black tracking-wide text-slate-800">ADMIN PORTAL</span>
          </div>
          <p className="text-[10px] font-medium text-slate-500">Snap City AI · Municipal Control</p>
        </div>

        <nav className="flex-1 space-y-1">
          {[
            { id: 'reports', label: 'Reports', icon: FileText, count: stats.total },
            { id: 'stats', label: 'Statistics', icon: BarChart3 },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id as any)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                activeSection === item.id ? 'bg-violet-50 text-violet-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <item.icon className="h-4 w-4" />
                {item.label}
              </span>
              {item.count !== undefined && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeSection === item.id ? 'bg-violet-200 text-violet-800' : 'bg-slate-100 text-slate-500'}`}>
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Status legend */}
        <div className="mt-6 space-y-2 border-t border-slate-100 pt-5">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3">Status Legend</p>
          {[
            { label: 'Pending', dot: 'bg-amber-400' },
            { label: 'Approved', dot: 'bg-green-400' },
            { label: 'In Progress', dot: 'bg-blue-400' },
            { label: 'Denied', dot: 'bg-rose-400' },
            { label: 'Resolved', dot: 'bg-emerald-400' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <div className={`h-2 w-2 rounded-full shadow-sm ${s.dot}`} />
              {s.label}
            </div>
          ))}
        </div>

        <button onClick={logout} className="mt-6 flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors">
          <LogOut className="h-3.5 w-3.5" /> Sign Out
        </button>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 overflow-auto bg-slate-50/50">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
          <div>
            <h1 className="text-lg font-black text-slate-800 flex items-center gap-2">
              {activeSection === 'reports' ? (
                <><FileText className="h-5 w-5 text-violet-500" /> Civic Reports</>
              ) : (
                <><BarChart3 className="h-5 w-5 text-violet-500" /> Statistics</>
              )}
            </h1>
            <p className="text-xs font-medium text-slate-500">{user?.email}  ·  {new Date().toLocaleDateString('en-IN')}</p>
          </div>
          {stats.highSeverity > 0 && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 shadow-sm">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              <span className="text-xs font-bold text-rose-700">{stats.highSeverity} High Severity</span>
            </div>
          )}
        </div>

        <div className="p-6">

          {/* ── STATS VIEW ── */}
          {activeSection === 'stats' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'Total Reports', value: stats.total, color: 'border-slate-200' },
                  { label: 'Pending', value: stats.pending, color: 'border-amber-200' },
                  { label: 'Approved', value: stats.approved, color: 'border-green-200' },
                  { label: 'In Progress', value: stats.inProgress, color: 'border-blue-200' },
                  { label: 'Denied', value: stats.denied, color: 'border-rose-200' },
                  { label: 'Resolved', value: stats.resolved, color: 'border-emerald-200' },
                ].map(s => (
                  <div key={s.label} className={`rounded-2xl border ${s.color} bg-white shadow-sm p-5 hover:shadow-md transition-shadow`}>
                    <p className="text-4xl font-black text-slate-800">{s.value}</p>
                    <p className="text-sm font-semibold text-slate-500 mt-1">{s.label}</p>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                      {stats.total > 0 ? Math.round((s.value / stats.total) * 100) : 0}% of total
                    </p>
                  </div>
                ))}
              </div>
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5">
                <h3 className="text-sm font-bold text-slate-700 mb-4">Resolution Rate</h3>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200 shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-green-500 rounded-full transition-all"
                    style={{ width: `${stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0}%` }}
                  />
                </div>
                <p className="text-xs font-medium text-slate-500 mt-3 text-right">
                  {stats.resolved} of {stats.total} complaints resolved · {stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0}%
                </p>
              </div>
            </div>
          )}

          {/* ── REPORTS VIEW ── */}
          {activeSection === 'reports' && (
            <>
              {/* Filters */}
              <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex flex-wrap gap-1.5 items-center justify-center">
                  <span className="flex items-center gap-1 text-xs text-slate-400 font-bold uppercase tracking-wider mr-2">
                    <Filter className="h-3.5 w-3.5 text-violet-400" /> Dept
                  </span>
                  {DEPARTMENTS.map(d => (
                    <button key={d} onClick={() => setSelectedDept(d)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                        selectedDept === d ? 'bg-violet-600 text-white shadow-violet-200' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                      }`}>{d}</button>
                  ))}
                </div>
                <div className="w-px h-6 bg-slate-200 hidden sm:block mx-2"></div>
                <div className="flex flex-wrap gap-1.5 items-center justify-center">
                  {STATUS_FILTERS.map(s => (
                    <button key={s} onClick={() => setSelectedStatus(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                        selectedStatus === s ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                      }`}>{s}</button>
                  ))}
                </div>
                <span className="text-xs font-bold text-slate-400 ml-auto shrink-0 bg-slate-100 px-3 py-1.5 rounded-lg">
                  {filteredReports.length} / {stats.total}
                </span>
              </div>

              {loading ? (
                <div className="flex justify-center py-24">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-500 border-t-transparent shadow-lg" />
                </div>
              ) : filteredReports.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/50 py-24 text-center shadow-sm">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-violet-50 mb-6">
                    <CheckCircle2 className="h-10 w-10 text-violet-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-700">No reports found</h3>
                  <p className="mt-2 text-slate-500 font-medium">Try adjusting your filters</p>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredReports.map(report => (
                    <div key={report.id} className="flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-violet-200 transition-all duration-300">

                      {/* Image */}
                      <div className="relative h-44 bg-slate-100 overflow-hidden group">
                        {report.imageUrl ? (
                          <img src={report.imageUrl} alt="Issue" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-slate-300 bg-slate-50">
                            <ImageIcon className="h-12 w-12 opacity-50" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-80"></div>
                        {/* Severity badge */}
                        <div className="absolute top-3 left-3 flex gap-1.5">
                          <span className={`text-[10px] shadow-sm backdrop-blur-md font-black px-2.5 py-1 rounded-lg ${
                            report.severity?.toLowerCase() === 'high' ? 'bg-rose-500/90 text-white' :
                            report.severity?.toLowerCase() === 'medium' ? 'bg-amber-500/90 text-white' : 'bg-emerald-500/90 text-white'
                          }`}>{report.severity?.toUpperCase() || 'N/A'}</span>
                          <span className="text-[10px] shadow-sm backdrop-blur-md font-bold bg-slate-800/90 text-white px-2.5 py-1 rounded-lg border border-slate-700/50">{report.department || 'Uncat.'}</span>
                          {report.isDuplicate && <span className="text-[10px] shadow-sm backdrop-blur-md font-bold bg-fuchsia-600/90 text-white px-2.5 py-1 rounded-lg hover:bg-fuchsia-500 transition-colors">DUP</span>}
                        </div>
                        {/* Current status top-right */}
                        <div className="absolute top-3 right-3 shadow-sm rounded-full">
                          {statusBadge(report.status)}
                        </div>
                      </div>

                      {/* Body */}
                      <div className="flex-1 px-5 pt-4 pb-5 flex flex-col">
                        {/* Token + location */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          {report.tokenId && (
                            <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-md px-2 py-0.5 flex items-center gap-1">
                              <Hash className="h-2.5 w-2.5 text-slate-400" />{report.tokenId}
                            </span>
                          )}
                          <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1 ml-auto bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                            <Clock3 className="h-3 w-3 text-slate-400" />
                            {report.createdAt?.toDate ? format(report.createdAt.toDate(), 'MMM d, yyyy') : 'Recent'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-violet-600 font-semibold mb-2 bg-violet-50 w-fit px-2.5 py-1 rounded-md">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="line-clamp-1">{report.location}</span>
                        </div>

                        <p className="text-sm font-black text-slate-800 line-clamp-2 leading-snug mb-3">{report.description}</p>

                        {report.assignedToEmail && (
                          <div className="text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 mb-3">
                            <ChevronRight className="h-3 w-3 text-blue-500 shrink-0" />
                            <span className="truncate">{report.assignedToEmail}</span>
                          </div>
                        )}

                        {/* Complaint snippet */}
                        {report.aiComplaint && (
                          <div className="relative mb-4 mt-auto">
                            <span className="absolute -top-2 -left-1 text-2xl text-slate-200 font-serif">"</span>
                            <p className="text-[11px] font-medium text-slate-600 italic line-clamp-3 bg-slate-50/80 p-3 rounded-xl border border-slate-100 leading-relaxed">
                              {report.aiComplaint}
                            </p>
                          </div>
                        )}

                        {/* Reporter */}
                        <div className="flex items-center gap-2 mb-4 pt-4 border-t border-slate-100">
                          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-200 to-fuchsia-200 flex items-center justify-center text-violet-700 font-bold text-[10px]">
                            {report.userEmail.charAt(0).toUpperCase()}
                          </div>
                          <p className="text-[10px] font-medium text-slate-400">
                            Reported by <span className="text-slate-700 font-bold">{report.userEmail.split('@')[0]}</span>
                          </p>
                        </div>

                        {/* Feedback textarea */}
                        <div className="mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                              <MessageSquare className="h-3.5 w-3.5 text-slate-400" /> Admin Response
                            </label>
                            <button
                              onClick={() => handleGenerateFeedback(report)}
                              disabled={generatingFeedback === report.id}
                              className="flex items-center gap-1 text-[10px] font-bold text-violet-600 hover:text-violet-500 bg-violet-100/50 hover:bg-violet-100 px-2 py-1 rounded-md transition-colors"
                            >
                              {generatingFeedback === report.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Sparkles className="h-3 w-3" />}
                              AI Draft
                            </button>
                          </div>
                          <Textarea
                            placeholder="Write an official response..."
                            className="h-16 text-xs resize-none bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 rounded-lg focus:border-violet-300 focus:ring-violet-200 shadow-sm"
                            value={feedbacks[report.id] !== undefined ? feedbacks[report.id] : (report.adminFeedback || '')}
                            onChange={e => setFeedbacks(p => ({ ...p, [report.id]: e.target.value }))}
                          />
                        </div>

                        {/* ── 5 ACTION BUTTONS ── */}
                        <div className="grid grid-cols-2 gap-2 mt-auto">
                          {STATUS_ACTIONS.map(action => (
                            <button
                              key={action.value}
                              onClick={() => handleStatusUpdate(report, action.value)}
                              disabled={report.status === action.value}
                              className={`text-[10px] font-bold py-2 px-2 rounded-xl transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-1.5 ${colorMap[action.color]}`}
                            >
                              <action.icon className="h-3.5 w-3.5" />
                              {action.label}
                            </button>
                          ))}

                          {/* Delete */}
                          {confirmDeleteId === report.id ? (
                            <div className="col-span-2 flex gap-2 w-full p-1 bg-rose-50 rounded-xl border border-rose-100">
                              <button onClick={() => handleDelete(report.id)} className="flex-1 text-[10px] font-black py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 shadow-sm">
                                Confirm
                              </button>
                              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 text-[10px] font-bold py-1.5 rounded-lg bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-sm">
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(report.id)}
                              className="col-span-2 text-[10px] font-bold py-2 rounded-xl bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition-all shadow-sm flex items-center justify-center gap-1.5"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete Report
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

        </div>
      </main>
    </div>
  );
}
