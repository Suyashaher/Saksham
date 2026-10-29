import React from 'react';
import { ShieldAlert, Accessibility, Mail } from 'lucide-react';

interface SingleScreenFooterProps {
  onOpenAccessibility: () => void;
  onOpenContact: () => void;
}

export const SingleScreenFooter: React.FC<SingleScreenFooterProps> = ({
  onOpenAccessibility,
  onOpenContact,
}) => {
  return (
    <footer
      role="contentinfo"
      className="bg-[#060e18] text-slate-400 px-4 sm:px-6 lg:px-8 py-1.5 text-[10px] sm:text-[11px] shrink-0 border-t border-white/5 z-20"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-y-1">
        {/* Prototype Honesty Disclaimer */}
        <div className="flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-slate-400 font-normal">
            Prototype developed for Smart India Hackathon (PS 26265).{' '}
            <span className="text-slate-300 font-semibold">Not an official AICTE website.</span>
          </span>
        </div>

        {/* Links & Copyright */}
        <div className="flex items-center gap-3 text-slate-400">
          <button
            type="button"
            onClick={onOpenAccessibility}
            className="inline-flex items-center gap-1 hover:text-white transition-colors cursor-pointer focus:outline-none focus:underline"
          >
            <Accessibility className="w-3 h-3 text-slate-400" />
            <span>Accessibility</span>
          </button>

          <span className="text-slate-700">|</span>

          <button
            type="button"
            onClick={onOpenContact}
            className="inline-flex items-center gap-1 hover:text-white transition-colors cursor-pointer focus:outline-none focus:underline"
          >
            <Mail className="w-3 h-3 text-slate-400" />
            <span>Contact & Helpdesk</span>
          </button>

          <span className="text-slate-700">|</span>

          <span className="text-slate-500">© 2026 Saksham Prototype</span>
        </div>
      </div>
    </footer>
  );
};
