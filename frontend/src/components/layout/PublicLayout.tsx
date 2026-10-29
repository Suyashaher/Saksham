import React from 'react';
import { Outlet } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

export const PublicLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Official Government Top Header Banner */}
      <div className="bg-slate-900 text-slate-300 text-xs py-1.5 px-4 md:px-8 border-b border-slate-800">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">भारत सरकार</span>
            <span className="text-slate-400">|</span>
            <span>Government of India</span>
          </div>
          <div className="hidden sm:block text-slate-400 text-[11px]">
            Ministry of Education • AICTE E-Governance
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          {/* Logo & Portal Branding */}
          <div className="text-center mb-6">
            <div className="inline-block p-1.5 rounded-full bg-white shadow-xl border-2 border-slate-200 mb-3">
              <img
                src="/saksham-logo.png"
                alt="Saksham Logo"
                className="w-24 h-24 object-contain rounded-full"
              />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-2">
              <span>SAKSHAM</span>
            </h1>
            <p className="text-sm font-bold text-primary mt-1">
              Secure AICTE Keeping, Scrutiny, Handling and Monitoring
            </p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              All India Council for Technical Education • Statutory Oversight
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <Outlet />
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>256-bit SSL Encrypted • Multi-Factor Authenticated</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-500 border-t border-slate-200 bg-white">
        <p>© {new Date().getFullYear()} Saksham — AICTE Security Deposit & Bank Guarantee Portal.</p>
        <p className="mt-0.5 text-[11px] text-slate-400">
          Unauthorized access is strictly prohibited and subject to prosecution under IT Act 2000.
        </p>
      </footer>
    </div>
  );
};
