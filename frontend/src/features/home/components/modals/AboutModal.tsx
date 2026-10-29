import React from 'react';
import { BaseModal } from './BaseModal';
import { AlertCircle, CheckCircle2, Shield, FileSpreadsheet, Clock } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="About the Saksham Portal"
      subtitle="Statutory Context & Unified Security Deposit Management System"
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* The Challenge */}
        <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs sm:text-sm text-slate-700 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-950 text-sm">
            <AlertCircle className="w-4 h-4 text-amber-700" />
            <span>The Legacy Operational Challenge</span>
          </div>
          <p className="leading-relaxed">
            Managing thousands of Fixed Deposit Receipts (FDRs) and Bank Guarantees across technical institutions historically depended on physical paper certificates, manual branch inquiries, and decentralized registers. This led to operational vulnerabilities such as missed 8-year maturity dates, delayed renewals, and friction during rightful deposit release.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-xs text-amber-900">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>Manual Branch Inquiries</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>Paper Storage Risks</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>Delayed Release Cycles</span>
            </div>
          </div>
        </div>

        {/* The Solution */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span>The Saksham Digital Solution</span>
          </div>
          <p className="leading-relaxed">
            Saksham establishes an authoritative single source of truth connecting technical institutions, regional scrutiny officers, issuing bank branches, and approving authorities. The platform automates validity countdowns, enforces independent bank verification tagging, and maintains an immutable cryptographic audit trail across every instrument.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-xs text-slate-800">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Central Digital Ledger</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>90/60/30-Day Alerts</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Bank-Verified Liens</span>
            </div>
          </div>
        </div>

        {/* Self-Declared vs Bank-Verified Principle */}
        <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-200 text-xs text-teal-950 space-y-1.5">
          <p className="font-bold text-teal-900">Core Principle: Separation of Declarations and Verifications</p>
          <p className="leading-relaxed">
            What an institution declares remains strictly categorized as <em>Self-Declared</em> until an official confirmation letter or API response from the issuing bank branch confirms the irrevocable lien in favor of AICTE, upgrading it to <em>Bank-Verified</em> status.
          </p>
        </div>
      </div>
    </BaseModal>
  );
};
