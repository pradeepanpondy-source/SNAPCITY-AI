import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { FileText, CheckCircle2, Clock3, TrendingUp, PlusCircle, Map as MapIcon, Loader2, Award, PieChart as PieChartIcon, ThumbsUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

interface Report {
  id: string;
  status: string;
  department?: string;
  upvotes?: string[];
  createdAt: any;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isDemoMode = user?.uid.startsWith('demo-');

    if (!db || !import.meta.env.VITE_FIREBASE_API_KEY || isDemoMode) {
      const localReports = JSON.parse(localStorage.getItem('demo_reports') || '[]');
      setReports(localReports);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'reports'));
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

  const totalReports = reports.length;
  const resolvedReports = reports.filter(r => r.status.toLowerCase().includes('completed') || r.status.toLowerCase().includes('resolved')).length;
  const pendingReports = totalReports - resolvedReports;
  
  // Calculate total upvotes received on user's reports
  const totalUpvotesReceived = reports.reduce((sum, r) => sum + (r.upvotes?.length || 0), 0);
  
  // Civic Points: 10 per report, 25 per resolved, 5 per upvote received
  const impactScore = (totalReports * 10) + (resolvedReports * 25) + (totalUpvotesReceived * 5);

  let civicLevel = "Bronze Citizen";
  if (impactScore > 500) civicLevel = "Platinum Citizen";
  else if (impactScore > 200) civicLevel = "Gold Citizen";
  else if (impactScore > 50) civicLevel = "Silver Citizen";

  // Department Analytics
  const deptCounts = reports.reduce((acc, r) => {
    const dept = r.department || 'Uncategorized';
    acc[dept] = (acc[dept] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const pieData = Object.entries(deptCounts)
    .map(([name, value]) => ({ name, value: value as number }))
    .sort((a, b) => b.value - a.value);
    
  const PIE_COLORS = ['#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#64748b'];

  // Mock chart data for visual appeal
  const chartData = [
    { name: 'Jan', reports: 12 },
    { name: 'Feb', reports: 19 },
    { name: 'Mar', reports: 15 },
    { name: 'Apr', reports: 22 },
    { name: 'May', reports: 28 },
    { name: 'Jun', reports: totalReports > 0 ? totalReports : 5 },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600 to-fuchsia-600 p-8 sm:p-10 text-white shadow-xl shadow-violet-200">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-40 w-40 rounded-full bg-white/10 blur-2xl"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-32 w-32 rounded-full bg-black/10 blur-xl"></div>
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Welcome back!</h1>
            <p className="mt-2 text-violet-100 text-lg max-w-xl">
              You are making a real difference in your community. Check your impact and recent civic activities below.
            </p>
          </div>
          <Link to="/report">
            <Button className="lovable-btn bg-white text-violet-600 hover:bg-violet-50 hover:text-violet-700 shadow-lg h-12 px-6 text-base whitespace-nowrap">
              <PlusCircle className="mr-2 h-5 w-5" />
              New Report
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="lovable-card">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
              <FileText className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Reports</p>
              <p className="text-3xl font-extrabold text-slate-800">{totalReports}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="lovable-card">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Resolved</p>
              <p className="text-3xl font-extrabold text-slate-800">{resolvedReports}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lovable-card">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
              <Clock3 className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Pending</p>
              <p className="text-3xl font-extrabold text-slate-800">{pendingReports}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lovable-card relative overflow-hidden">
          <div className="absolute -right-4 -top-4 h-24 w-24 bg-gradient-to-br from-fuchsia-400 to-violet-500 opacity-20 blur-2xl rounded-full"></div>
          <CardContent className="p-6 flex items-center gap-4 relative z-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-500 text-white shadow-md shadow-fuchsia-200">
              <Award className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Impact Score</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-extrabold bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">{impactScore}</p>
                <span className="text-xs font-bold text-fuchsia-600 bg-fuchsia-100 px-2 py-0.5 rounded-full">{civicLevel}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Section */}
        <Card className="lovable-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-violet-500" />
              Community Activity
            </CardTitle>
            <CardDescription>Reports submitted over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="reports" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#8b5cf6' : '#c4b5fd'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Department Analytics */}
        <Card className="lovable-card">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-fuchsia-500" />
              Issues by Department
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="w-full flex justify-center">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-slate-400 text-sm">
                No department data available yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions */}
        <div className="space-y-6 lg:col-span-3">
          <Card className="lovable-card h-full">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-slate-800">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link to="/report" className="block">
                <div className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-all hover:bg-violet-50 hover:border-violet-200 cursor-pointer">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                    <PlusCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 group-hover:text-violet-700">Report Issue</h4>
                    <p className="text-sm text-slate-500">Submit a new civic problem</p>
                  </div>
                </div>
              </Link>

              <Link to="/reports" className="block">
                <div className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-all hover:bg-fuchsia-50 hover:border-fuchsia-200 cursor-pointer">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-fuchsia-100 text-fuchsia-600 group-hover:bg-fuchsia-600 group-hover:text-white transition-colors">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 group-hover:text-fuchsia-700">View Reports</h4>
                    <p className="text-sm text-slate-500">Browse all community issues</p>
                  </div>
                </div>
              </Link>

              <Link to="/map" className="block">
                <div className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-all hover:bg-emerald-50 hover:border-emerald-200 cursor-pointer">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <MapIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 group-hover:text-emerald-700">Issue Map</h4>
                    <p className="text-sm text-slate-500">View issues on a map</p>
                  </div>
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
