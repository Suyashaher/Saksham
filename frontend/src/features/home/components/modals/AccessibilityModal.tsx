import React from 'react';
import { BaseModal } from './BaseModal';
import { Accessibility, CheckCircle2, Mail } from 'lucide-react';
import { CONTACT_CONFIG } from '../../data/contactConfig';

interface AccessibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccessibilityModal: React.FC<AccessibilityModalProps> = ({ isOpen, onClose }) => {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Accessibility Statement"
      subtitle="Compliance with Guidelines for Indian Government Websites (GIGW) & WCAG 2.1 Level AA"
      maxWidth="xl"
    >
      <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
        <div className="flex items-center gap-2 text-primary font-bold text-sm">
          <Accessibility className="w-4 h-4" />
          <span>Commitment to Digital Inclusion</span>
        </div>

        <p>
          The Saksham Portal has been engineered to comply with the <strong>Web Content Accessibility Guidelines (WCAG) 2.1 Level AA</strong> and the Unified User Experience for Government (UX4G) standards.
        </p>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <h4 className="font-bold text-slate-900 text-xs">Supported Accessibility Features:</h4>
          <ul className="space-y-1.5 pl-1">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span><strong>Skip to Main Content:</strong> Quick jump landmark for screen reader & keyboard navigation.</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span><strong>Text Size Adjustment:</strong> Font enlargement controls (A-, A, A+) persisted across the session.</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span><strong>High Contrast Mode:</strong> Stark black, white, and yellow visual palette exceeding 7:1 contrast.</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span><strong>Keyboard Operability:</strong> Complete focus trapping in dialogs, Escape key to close, visible focus rings.</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span><strong>Reduced Motion:</strong> Respects <code>prefers-reduced-motion</code> system preferences.</span>
            </li>
          </ul>
        </div>

        <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-teal-950 flex items-center gap-2">
          <Mail className="w-4 h-4 text-teal-700 shrink-0" />
          <span>
            Feedback & Accessibility Grievances: <a href={`mailto:${CONTACT_CONFIG.helpdeskEmail}`} className="font-bold underline">{CONTACT_CONFIG.helpdeskEmail}</a>
          </span>
        </div>
      </div>
    </BaseModal>
  );
};
