import React from 'react';
import { Bot, CheckCircle2, Lock, ShieldCheck, Sparkles, X } from 'lucide-react';
import { DataSourceBadge } from './DataSourceBadge';

export interface AboutAiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutAiModal: React.FC<AboutAiModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-ai-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 id="about-ai-title" className="text-base font-bold text-slate-900">
                About AI Assistance in Saksham Portal
              </h2>
              <p className="text-xs text-slate-500">
                Ethical, explainable decision support architecture (SIH PS 26265)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm text-slate-700 leading-relaxed">
          {/* Invariant 1: Human in the loop */}
          <div className="flex items-start gap-3 p-3.5 bg-emerald-50/80 rounded-lg border border-emerald-200">
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-emerald-900 text-sm">
                Officers Always Decide — AI Only Assists
              </h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                No AI pipeline can modify instrument lifecycle statuses, grant approvals, reject requests,
                or alter core records. AI outputs (OCR extractions, trust scores, turnaround predictions)
                serve strictly as advisory suggestions for scrutiny officers.
              </p>
            </div>
          </div>

          {/* Invariant 2: Synthetic training data */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900 text-sm">Model Training & Data Provenance</h3>
              <DataSourceBadge source="synthetic" showTooltip={false} />
            </div>
            <p className="text-xs text-slate-600">
              In strict adherence to governance standards, all predictive models are initialized and trained
              exclusively on <strong>synthesized simulation data</strong>. Predictions represent statistical estimates
              to help officers organize scrutiny backlogs, never guaranteed turnaround times.
            </p>
          </div>

          {/* Invariant 3: Privacy & Data Protection */}
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
              <Lock className="w-4 h-4 text-primary" />
              <span>Zero Leakage Privacy Guard</span>
            </div>
            <p className="text-xs text-slate-600">
              The portal features an enforce-by-design <code>LlmPayloadGuard</code>. Raw document binaries,
              passwords, beneficiary personal details, and confidential OTP tokens are never transmitted
              to external language models or telemetry logs.
            </p>
          </div>

          {/* Invariant 4: Kill switches */}
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <h3 className="font-semibold text-slate-900 text-sm">Kill Switches & Independent Fallbacks</h3>
            <p className="text-xs text-slate-600">
              Every AI capability operates behind runtime toggles (<code>AI_ENABLED</code>, <code>AI_OCR_ENABLED</code>, <code>AI_TRUST_ENABLED</code>, etc.).
              If any AI service or model experiences unavailability, the application seamlessly reverts to
              classical deterministic rules and manual forms without service disruption.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            Portal Version: v1.5.0-gov (Phase 7B/7C)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-xs transition-colors"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
