import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Camera, LogOut, FileText, LayoutDashboard, MapPin, ShieldAlert } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navLink = (to: string, label: string, Icon: React.ElementType) => (
    <Link
      to={to}
      className={`inline-flex items-center px-1 pt-1 text-sm font-semibold transition-colors ${
        location.pathname === to
          ? 'text-black border-b-2 border-black'
          : 'text-gray-400 hover:text-black border-b-2 border-transparent'
      }`}
    >
      <Icon className="mr-2 h-4 w-4" />
      {label}
    </Link>
  );

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex flex-shrink-0 items-center gap-2.5 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white shadow transition-transform group-hover:scale-105">
                <Camera className="h-5 w-5" />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-black">
                Snap City <span className="text-gray-400">AI</span>
              </span>
            </Link>

            {/* Nav links (logged in only) */}
            {user && (
              <div className="hidden sm:ml-10 sm:flex sm:space-x-8">
                {/* Citizen links */}
                {user.role !== 'admin' && (
                  <>
                    {navLink('/dashboard', 'Dashboard', LayoutDashboard)}
                    {navLink('/report', 'Report Issue', Camera)}
                    {navLink('/reports', 'All Reports', FileText)}
                    {navLink('/map', 'Issue Map', MapPin)}
                  </>
                )}
                {/* Admin only */}
                {user.role === 'admin' && (
                  <Link
                    to="/admin"
                    className={`inline-flex items-center px-1 pt-1 text-sm font-semibold transition-colors ${
                      location.pathname === '/admin'
                        ? 'text-red-600 border-b-2 border-red-500'
                        : 'text-gray-400 hover:text-red-600 border-b-2 border-transparent'
                    }`}
                  >
                    <ShieldAlert className="mr-2 h-4 w-4" />
                    Admin Portal
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* User / Login */}
          <div className="flex items-center">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex flex-col items-end">
                  {user.role === 'admin' && (
                    <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Admin</span>
                  )}
                  <span className="text-sm font-semibold text-gray-700">{user.email}</span>
                </div>
                <Button variant="outline" size="sm" onClick={logout} className="rounded-xl border-gray-200 hover:bg-gray-100 hover:text-black font-semibold">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </div>
            ) : (
              <Link to="/login">
                <Button size="sm" className="rounded-xl bg-black text-white hover:bg-gray-800 font-semibold px-6">
                  Login
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
