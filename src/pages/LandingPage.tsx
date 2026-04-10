import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Camera,
  ArrowRight,
  CheckCircle2,
  Upload,
  Brain,
  Tag,
  Hash,
  Database,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const steps = [
  {
    num: '01',
    icon: Upload,
    title: 'Upload an Image',
    desc: 'Take a photo of any civic issue — pothole, garbage, broken streetlight, or water leakage.',
  },
  {
    num: '02',
    icon: Brain,
    title: 'AI Validates & Analyzes',
    desc: 'Gemini AI checks if the image is a real civic problem, rejects fakes or irrelevant images.',
  },
  {
    num: '03',
    icon: Tag,
    title: 'Issue Auto-Categorized',
    desc: 'The AI automatically detects the issue type, severity, and responsible department.',
  },
  {
    num: '04',
    icon: Hash,
    title: 'Unique Token Generated',
    desc: 'A unique Token ID (e.g. SC-2026-A3F7B2C1) is created so you can track your complaint.',
  },
  {
    num: '05',
    icon: Database,
    title: 'Stored in Firebase',
    desc: 'Your report, image, location, and AI analysis are securely stored in the cloud.',
  },
  {
    num: '06',
    icon: ShieldCheck,
    title: 'Admin Reviews & Acts',
    desc: 'The zonal officer receives the complaint by email and can update the status in the admin portal.',
  },
];

export default function LandingPage() {
  const { user } = useAuth();

  // Redirect logged-in users based on role
  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  return (
    <div className="min-h-screen bg-white text-black">

      {/* ── HERO ── */}
      <section className="relative overflow-hidden px-4 pt-24 pb-20 sm:px-6 lg:px-8 border-b border-gray-100">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2YzZjRmNiIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-60" />
        <div className="relative mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5">
            <Sparkles className="h-3.5 w-3.5 text-gray-500" />
            <span className="text-xs font-semibold text-gray-600 tracking-wide uppercase">Powered by Google Gemini AI</span>
          </div>

          <h1 className="text-5xl font-black tracking-tight text-black sm:text-6xl lg:text-7xl leading-[1.05]">
            Snap City
            <span className="block text-gray-400">AI</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-500 leading-relaxed">
            A smart civic issue reporting platform. Upload a photo of any public problem,
            and AI automatically categorizes it, drafts a formal complaint, and routes it
            to the right municipal authority.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link to="/login">
              <Button className="h-13 px-8 text-base font-bold bg-black text-white hover:bg-gray-800 rounded-xl shadow-lg transition-all hover:-translate-y-0.5">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" className="h-13 px-8 text-base font-semibold border-2 border-gray-200 text-gray-700 hover:border-gray-400 hover:text-black rounded-xl transition-all">
                Sign In
              </Button>
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-5 text-sm font-medium text-gray-400">
            {['No credit card required', 'Free to use', 'AI-powered analysis'].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-black" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── OVERVIEW ── */}
      <section className="px-4 py-20 sm:px-6 lg:px-8 bg-gray-50 border-b border-gray-100">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Overview</span>
            <h2 className="mt-3 text-4xl font-black text-black">What is Snap City AI?</h2>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 items-center">
            <div className="space-y-5">
              {[
                {
                  title: 'Upload & Report',
                  desc: 'Citizens upload photos of civic issues like potholes, garbage dumps, broken streetlights, or drainage problems directly from their phones.',
                },
                {
                  title: 'AI Analyzes & Classifies',
                  desc: 'Google Gemini AI inspects the image for authenticity, classifies the issue type, assigns severity, and crafts a formal complaint letter.',
                },
                {
                  title: 'Auto-Routed to Authorities',
                  desc: 'The complaint is automatically emailed to the correct Tamil Nadu municipal zonal officer based on the GPS-detected district.',
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="mt-1 flex-shrink-0 h-5 w-5 rounded-full bg-black flex items-center justify-center">
                    <CheckCircle2 className="h-3 w-3 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-black">{item.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-black rounded-2xl p-8 text-white space-y-4">
              <Camera className="h-10 w-10 text-gray-400 mb-2" />
              <p className="text-2xl font-black leading-tight">
                From photo to official complaint — in under a minute.
              </p>
              <p className="text-sm text-gray-400">
                Snap City AI does the heavy lifting so citizens can spend time on what matters — making their community better.
              </p>
              <Link to="/login">
                <Button className="mt-4 bg-white text-black hover:bg-gray-100 rounded-xl font-bold">
                  Try it now <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="px-4 py-20 sm:px-6 lg:px-8 border-b border-gray-100">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Process</span>
            <h2 className="mt-3 text-4xl font-black text-black">How It Works</h2>
            <p className="mt-3 text-gray-500">Six simple steps from photo to resolution.</p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {steps.map((step, i) => (
              <div
                key={step.num}
                className={`rounded-2xl border p-6 transition-all hover:-translate-y-1 hover:shadow-md ${
                  i === 0 ? 'bg-black text-white border-black' : 'bg-white text-black border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <step.icon className={`h-6 w-6 ${i === 0 ? 'text-gray-400' : 'text-black'}`} />
                  <span className={`text-xs font-black tracking-widest ${i === 0 ? 'text-gray-500' : 'text-gray-300'}`}>
                    {step.num}
                  </span>
                </div>
                <h3 className={`text-base font-bold mb-2 ${i === 0 ? 'text-white' : 'text-black'}`}>{step.title}</h3>
                <p className={`text-sm leading-relaxed ${i === 0 ? 'text-gray-400' : 'text-gray-500'}`}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-4xl font-black text-black">Start making a difference today</h2>
          <p className="mt-4 text-gray-500 text-lg">
            Join citizens using Snap City AI to hold municipalities accountable.
          </p>
          <Link to="/login">
            <Button className="mt-8 h-13 px-10 text-base font-bold bg-black text-white hover:bg-gray-800 rounded-xl shadow-lg transition-all hover:-translate-y-0.5">
              Create Free Account
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-gray-100 bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-black text-white">
            <Camera className="h-3.5 w-3.5" />
          </div>
          <span className="font-bold text-black">Snap City AI</span>
        </div>
        <p>Powered by Google Gemini AI &amp; Firebase · Built for Tamil Nadu citizens</p>
      </footer>
    </div>
  );
}
