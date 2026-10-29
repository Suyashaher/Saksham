import React, { useState } from 'react';
import { AlertCircle, Check, CheckCircle2, FileText, Loader2, Upload, Wand2, X } from 'lucide-react';
import { aiApi, OcrFieldResponse, OcrPreviewResponse } from '../../../api/ai';
import { formatApiError } from '../../../api/client';
import { formatINR } from '../../../utils/formatters';
import { useToast } from '../../../components/ui/Toast';

export interface OcrReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFields: (selectedFields: Record<string, string>) => void;
  currentFormValues?: Record<string, any>;
}

const DOCUMENT_TYPES = [
  { value: 'FDR_SCAN', label: 'FDR Certificate Scan (Standard)' },
  { value: 'BANK_GUARANTEE_DOCUMENT', label: 'Bank Guarantee (BG) Instrument' },
  { value: 'DEPOSIT_CONFIRMATION', label: 'Bank Deposit Confirmation Slip' },
  { value: 'BANK_LETTER', label: 'Bank Confirmation Letter' },
  { value: 'RENEWAL_CERTIFICATE', label: 'Renewal Certificate / Extension Letter' },
  { value: 'CLOSURE', label: 'Closure / Release Certificate' },
  { value: 'OTHER', label: 'Other Bank Financial Document' },
];

export const OcrReviewModal: React.FC<OcrReviewModalProps> = ({
  isOpen,
  onClose,
  onApplyFields,
  currentFormValues = {},
}) => {
  const { success, error: toastError } = useToast();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('FDR_SCAN');
  const [isLoading, setIsLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrPreviewResponse | null>(null);
  const [selectedFieldKeys, setSelectedFieldKeys] = useState<Record<string, boolean>>({});
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 5 MB for sync OCR)
    if (file.size > 5 * 1024 * 1024) {
      toastError('File Too Large', 'Please select a document smaller than 5 MB.');
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl(null);
    }
  };

  const handleRunOcr = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setOcrResult(null);

    try {
      const res = await aiApi.ocrPreview(selectedFile, docType);
      setOcrResult(res);

      // Pre-select fields with confidence >= 0.70
      const initialSelection: Record<string, boolean> = {};
      res.field_details.forEach((fd) => {
        initialSelection[fd.name] = fd.confidence >= 0.7 && !!fd.value;
      });
      setSelectedFieldKeys(initialSelection);
      success('Extraction Complete', `Extracted ${res.field_details.length} fields with ${Math.round(res.overall_confidence * 100)}% overall confidence.`);
    } catch (err: any) {
      const detail = formatApiError(err, 'OCR extraction failed. Please enter details manually.');
      toastError('OCR Failed', detail);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFieldSelection = (fieldName: string) => {
    setSelectedFieldKeys((prev) => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }));
  };

  const handleApply = () => {
    if (!ocrResult) return;

    const fieldsToApply: Record<string, string> = {};
    ocrResult.field_details.forEach((fd) => {
      if (selectedFieldKeys[fd.name] && fd.value) {
        fieldsToApply[fd.name] = fd.value;
      }
    });

    onApplyFields(fieldsToApply);
    success('Fields Applied', 'Extracted details applied to submission form.');
    onClose();
  };

  const formatFieldValue = (name: string, val: string | null) => {
    if (!val) return '—';
    if (name.includes('amount') || name.includes('principal')) {
      return formatINR(val);
    }
    return val;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ocr-review-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="ocr-review-title" className="text-base font-bold text-slate-900">
                Document OCR Auto-Fill & Review
              </h2>
              <p className="text-xs text-slate-500">
                Inspect extracted fields side-by-side before applying them to the form
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

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Step 1: Document Upload & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Document Type
              </label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                disabled={isLoading}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {DOCUMENT_TYPES.map((dt) => (
                  <option key={dt.value} value={dt.value}>
                    {dt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Upload File (PDF / JPG / PNG, max 5MB)
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                disabled={isLoading}
                className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
              />
            </div>

            <div>
              <button
                type="button"
                onClick={handleRunOcr}
                disabled={!selectedFile || isLoading}
                className="w-full py-2 px-4 text-xs font-semibold rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Extracting Text...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    <span>Extract with OCR</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Step 2: Extraction Results Table */}
          {ocrResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">Extracted Fields:</span>
                  <span className="text-xs text-slate-500 font-mono">
                    Engine: {ocrResult.engine} ({ocrResult.duration_ms}ms, {ocrResult.page_count} {ocrResult.page_count === 1 ? 'page' : 'pages'})
                  </span>
                </div>
                <div className="text-xs font-semibold text-slate-700">
                  Overall Confidence:{' '}
                  <span className="text-emerald-700 font-bold">
                    {Math.round(ocrResult.overall_confidence * 100)}%
                  </span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Apply</th>
                      <th className="py-2.5 px-3">Field</th>
                      <th className="py-2.5 px-3">Extracted Value</th>
                      <th className="py-2.5 px-3">Confidence</th>
                      <th className="py-2.5 px-3">Current Form Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {ocrResult.field_details.map((field) => {
                      const confidencePct = Math.round(field.confidence * 100);
                      const isHigh = field.confidence >= 0.8;
                      const isMedium = field.confidence >= 0.7 && field.confidence < 0.8;
                      const currentVal = currentFormValues[field.name];

                      return (
                        <tr
                          key={field.name}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            selectedFieldKeys[field.name] ? 'bg-violet-50/30' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={!!selectedFieldKeys[field.name]}
                              onChange={() => toggleFieldSelection(field.name)}
                              disabled={!field.value}
                              className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary"
                              aria-label={`Apply extracted ${field.name}`}
                            />
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800 capitalize">
                            {field.name.replace(/_/g, ' ')}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                            {formatFieldValue(field.name, field.value)}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    isHigh ? 'bg-emerald-500' : isMedium ? 'bg-amber-500' : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${confidencePct}%` }}
                                />
                              </div>
                              <span
                                className={`text-[11px] font-bold ${
                                  isHigh ? 'text-emerald-700' : isMedium ? 'text-amber-700' : 'text-rose-700'
                                }`}
                              >
                                {confidencePct}%
                              </span>
                              {!isHigh && (
                                <span className="text-[10px] text-amber-600 bg-amber-50 px-1 rounded border border-amber-200">
                                  Please check
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {currentVal ? formatFieldValue(field.name, currentVal) : <span className="italic">Empty</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Loading status with aria-live */}
          {isLoading && (
            <div
              role="status"
              aria-live="polite"
              className="p-8 text-center text-slate-600 space-y-2 bg-slate-50 rounded-lg border border-slate-200"
            >
              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
              <p className="text-sm font-semibold text-slate-800">Processing document through OCR engine...</p>
              <p className="text-xs text-slate-500">
                Rendering pages, enhancing image contrast, and normalizing Indian bank fields.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            Advisory pre-fill only: applying fields modifies form inputs; nothing is lodged until you submit.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!ocrResult || Object.values(selectedFieldKeys).filter(Boolean).length === 0}
              className="px-4 py-2 text-xs font-semibold rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-xs"
            >
              Apply Selected Fields
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
