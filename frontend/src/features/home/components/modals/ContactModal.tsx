import React from 'react';
import { BaseModal } from './BaseModal';
import { CONTACT_CONFIG } from '../../data/contactConfig';
import { Mail, Phone, Clock, MapPin, LifeBuoy, ShieldAlert } from 'lucide-react';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose }) => {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Contact & Support Helpdesk"
      subtitle="AICTE Regulation Bureau & Technical Support Desk"
      maxWidth="xl"
    >
      <div className="space-y-4">
        {/* Support Helpdesk */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <LifeBuoy className="w-4 h-4" />
            <span>Technical Assistance</span>
          </div>

          <div className="space-y-2 text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary shrink-0" />
              <span>Email: </span>
              <a href={`mailto:${CONTACT_CONFIG.helpdeskEmail}`} className="font-bold text-primary hover:underline">
                {CONTACT_CONFIG.helpdeskEmail}
              </a>
            </div>

            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary shrink-0" />
              <span>Helpline: </span>
              <span className="font-semibold text-slate-900">{CONTACT_CONFIG.helplinePhone}</span>
            </div>

            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>{CONTACT_CONFIG.supportHours}</span>
            </div>
          </div>
        </div>

        {/* Head Office */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-700">
          <div className="flex items-center gap-2 text-slate-900 font-bold">
            <MapPin className="w-4 h-4 text-teal-700 shrink-0" />
            <span>Headquarters Address</span>
          </div>
          <p className="leading-relaxed pl-6">{CONTACT_CONFIG.headquartersAddress}</p>
        </div>

        {/* Emergency Escalation */}
        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Grievance Escalation: </span>
            <span>
              For delays in statutory release or urgent scrutiny inquiries, contact: {CONTACT_CONFIG.emergencyEscalation}
            </span>
          </div>
        </div>
      </div>
    </BaseModal>
  );
};
