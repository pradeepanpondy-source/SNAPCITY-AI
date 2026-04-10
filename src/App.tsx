/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import Dashboard from '@/pages/Dashboard';
import Home from '@/pages/Home';
import Reports from '@/pages/Reports';
import IssueMap from '@/pages/IssueMap';
import Login from '@/pages/Login';
import AdminDashboard from '@/pages/AdminDashboard';
import LandingPage from '@/pages/LandingPage';

// Redirect logged-in users to the right dashboard based on role
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-black border-t-transparent" /></div>;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-black border-t-transparent" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

// Strict admin-only — no demo bypass
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-black border-t-transparent" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col font-sans">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Public landing page */}
              <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
              {/* Auth */}
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              {/* Protected */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/report" element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/map" element={<ProtectedRoute><IssueMap /></ProtectedRoute>} />
              <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <Toaster position="top-center" toastOptions={{ style: { borderRadius: '12px', fontWeight: 600 } }} />
        </div>
      </Router>
    </AuthProvider>
  );
}

