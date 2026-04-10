import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Navigate } from 'react-router-dom';
import { Camera, Loader2, Mail, Lock, ShieldAlert } from 'lucide-react';

export default function Login() {
  const { user, login, signup } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Redirect already-logged-in users
  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    setAuthError(null);

    // Resolve shorthand "admin" username → real admin email
    const resolvedEmail = email.trim().toLowerCase() === 'admin'
      ? 'admin@snapcity.ai'
      : email.trim();

    try {
      if (isLogin) {
        await login(resolvedEmail, password);
      } else {
        await signup(resolvedEmail, password);
      }
    } catch (error: any) {
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        setAuthError('Invalid email or password. Please try again.');
      } else if (error.code === 'auth/email-already-in-use') {
        setAuthError('This email is already registered. Try signing in instead.');
      } else {
        setAuthError(error.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-white">
      {/* Left column — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-black flex-col justify-between p-12">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black">
            <Camera className="h-5 w-5" />
          </div>
          <span className="text-xl font-extrabold text-white tracking-tight">
            Snap City <span className="text-gray-500">AI</span>
          </span>
        </div>
        <div>
          <p className="text-4xl font-black text-white leading-tight mb-4">
            Report issues.<br />Track progress.<br />Fix your city.
          </p>
          <p className="text-gray-500 text-base">
            Upload a photo of any civic problem and let AI handle the rest — from complaint drafting to auto-routing to the right authority.
          </p>
        </div>
        <p className="text-xs text-gray-600">Powered by Google Gemini AI · Tamil Nadu Municipal Corp.</p>
      </div>

      {/* Right column — form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-sm">
          {/* Admin mode banner */}
          {isAdminMode && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <ShieldAlert className="h-5 w-5 text-red-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-700">Admin Login Mode</p>
                <p className="text-xs text-red-500">You'll be redirected to the Admin Portal.</p>
              </div>
            </div>
          )}

          <h2 className="text-3xl font-black text-black mb-1">
            {isLogin ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="text-sm text-gray-500 mb-8">
            {isLogin
              ? isAdminMode ? 'Sign in to access the admin dashboard.' : 'Sign in to your Snap City AI account.'
              : 'Sign up to start reporting civic issues.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {authError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium">
                {authError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wider" htmlFor="email">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white text-base"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wider" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="pl-10 h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white text-base"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-base font-bold bg-black text-white hover:bg-gray-800 rounded-xl"
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLogin ? 'Sign In' : 'Sign Up'}
            </Button>
          </form>

          {/* Toggle sign in / sign up */}
          <p className="mt-6 text-center text-sm text-gray-500">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setAuthError(null); }}
              className="font-bold text-black hover:underline"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>

          {/* Admin mode toggle */}
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <button
              type="button"
              onClick={() => { setIsAdminMode(!isAdminMode); setAuthError(null); }}
              className={`flex items-center gap-2 mx-auto text-xs font-semibold transition-colors ${
                isAdminMode ? 'text-red-600 hover:text-red-700' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              {isAdminMode ? 'Switch to Citizen Login' : 'Login as Admin'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
