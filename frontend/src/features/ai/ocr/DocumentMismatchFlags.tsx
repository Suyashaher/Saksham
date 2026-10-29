import React from 'react';
import { AlertTriangle, FileWarning, HelpCircle } from 'lucide-react';
import { FeedbackButtons } from '../../../components/ui/ai/FeedbackButtons';

export interface ValidationFlag {
  code: string; // 'OCR_MISMATCH' | 'CROSS_DOC_MISMATCH' | 'DOC_TYPE_SUSPECT' | etc.
  message?: string;
  field?: string;
  declared?: string;
  extracted?: string;
  doc_id?: string;
  details?: Record<string, unknown>;
  severity?: string;
}

export interface DocumentMismatchFlagsProps {
  flags: ValidationFlag[];
  instrumentId: string;
  className?: string;
}

export const DocumentMismatchFlags: React.FC<DocumentMismatchFlagsProps> = ({
  flags,
  instrumentId,
  className = '',
}) => {
  if (!flags || flags.length === 0) {
    return null;
  }

  // Filter for OCR/document-related flags
  const aiFlags = flags.filter((f) =>
    ['OCR_MISMATCH', 'CROSS_DOC_MISMATCH', 'DOC_TYPE_SUSPECT'].includes(f.code)
  );

  if (aiFlags.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <FileWarning className="w-4 h-4 text-amber-600" />
        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
          Document Intelligence Warnings ({aiFlags.length})
        </h4>
      </div>

      <div className="space-y-2.5">
        {aiFlags.map((flag, idx) => {
          let title = 'Document Consistency Notice';
          let description = flag.message || '';

          if (flag.code === 'OCR_MISMATCH') {
            title = `OCR Discrepancy: ${flag.field ? flag.field.replace(/_/g, ' ') : 'Field value mismatch'}`;
            description = `Declared value "${flag.declared || '—'}" differs from OCR extracted value "${flag.extracted || '—'}".`;
          } else if (flag.code === 'CROSS_DOC_MISMATCH') {
            title = 'Cross-Document Inconsistency';
            description = flag.message || 'Discrepancy detected across uploaded FDR certificate and confirmation slip.';
          } else if (flag.code === 'DOC_TYPE_SUSPECT') {
            title = 'Document Classification Alert';
            description = flag.message || "This file does not appear to match its declared document category.";
          }

          return (
            <div
              key={idx}
              className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg space-y-2 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-900">{title}</p>
                    <p className="text-amber-800 mt-0.5 leading-relaxed">{description}</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-200/60 text-amber-900 shrink-0 font-mono">
                  {flag.code}
                </span>
              </div>

              {flag.declared && flag.extracted && (
                <div className="grid grid-cols-2 gap-2 p-2 bg-white/70 rounded border border-amber-200/60 text-[11px]">
                  <div>
                    <span className="text-slate-500 font-medium block">Declared by Institution:</span>
                    <span className="font-semibold text-slate-800">{flag.declared}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">OCR Extracted:</span>
                    <span className="font-semibold text-amber-900">{flag.extracted}</span>
                  </div>
                </div>
              )}

              <div className="pt-1.5 border-t border-amber-200/50 flex items-center justify-between">
                <FeedbackButtons
                  feature="cross_check"
                  entityId={instrumentId}
                  outputRef={flag as any}
                  label="Flag quality:"
                  showDetails={true}
                />
                <span className="text-[10px] text-amber-700/80 italic">
                  Advisory warning: verify with physical/API records before acting.
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
