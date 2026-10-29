import React, { useState } from 'react';
import { Sparkles, Wand2 } from 'lucide-react';
import { useAiConfig } from '../../../components/ui/ai/AiProvider';
import { OcrReviewModal } from './OcrReviewModal';

export interface AutoFillButtonProps {
  onApplyFields: (fields: Record<string, string>) => void;
  currentFormValues?: Record<string, any>;
  className?: string;
}

export const AutoFillButton: React.FC<AutoFillButtonProps> = ({
  onApplyFields,
  currentFormValues = {},
  className = '',
}) => {
  const { isFeatureEnabled } = useAiConfig();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!isFeatureEnabled('ocr')) {
    return (
      <span className="text-[11px] text-slate-400 italic">
        Auto-fill unavailable. Enter details manually.
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-violet-600 text-white hover:bg-violet-700 shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-violet-400 ${className}`}
        title="Auto-fill form details from uploaded FDR certificate or bank letter"
        aria-label="Auto-fill form from document using OCR"
      >
        <Wand2 className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Auto-fill from Document</span>
      </button>

      <OcrReviewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onApplyFields={onApplyFields}
        currentFormValues={currentFormValues}
      />
    </>
  );
};
