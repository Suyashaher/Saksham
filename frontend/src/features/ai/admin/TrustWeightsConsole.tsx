import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, CheckCircle2, History, Info, Plus, Sliders, Sparkles } from 'lucide-react';
import { aiApi, WeightResponse } from '../../../api/ai';
import { queryKeys } from '../../../api/queryKeys';
import { useToast } from '../../../components/ui/Toast';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';

const DEFAULT_FACTORS: Record<string, number> = {
  document_completeness: 20,
  ocr_match: 15,
  bank_verification: 20,
  amount_reasonableness: 10,
  date_consistency: 10,
  alert_count: 10,
  cross_doc_consistency: 5,
  renewal_chain_integrity: 5,
  response_timeliness: 3,
  bank_reputation: 2,
};

const FACTOR_LABELS: Record<string, string> = {
  document_completeness: 'Document Completeness (All required docs present)',
  ocr_match: 'OCR vs Declared Match (Low mismatch count)',
  bank_verification: 'Bank Verification Tag & Method (API > QR > Letter)',
  amount_reasonableness: 'Amount Reasonableness (Against institutional baseline)',
  date_consistency: 'Date Consistency (Issue vs Maturity vs Tenure)',
  alert_count: 'Alert Count (Absence of open alerts on instrument)',
  cross_doc_consistency: 'Cross-Document Consistency (FDR vs Confirmation Slip)',
  renewal_chain_integrity: 'Renewal Chain Integrity (Unbroken renewal lineage)',
  response_timeliness: 'Response Timeliness (Days to resolve discrepancy)',
  bank_reputation: 'Bank Reputation Classification (Scheduled > Co-op > Other)',
};

export const TrustWeightsConsole: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingWeights, setEditingWeights] = useState<Record<string, number>>(DEFAULT_FACTORS);
  const [selectedVersion, setSelectedVersion] = useState<WeightResponse | null>(null);
  const [showConfirmActivate, setShowConfirmActivate] = useState(false);
  const [showSuggestProposal, setShowSuggestProposal] = useState(false);

  const { data: weightVersions, isLoading } = useQuery({
    queryKey: queryKeys.ai.weights,
    queryFn: aiApi.getWeights,
  });

  const updateMutation = useMutation({
    mutationFn: (weights: Record<string, number>) => aiApi.updateWeights(weights),
    onSuccess: (data) => {
      success('Weights Version Created', `Version ${data.version} is now the active policy.`);
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.weights });
      setIsEditorOpen(false);
      setShowConfirmActivate(false);
    },
    onError: (err: any) => {
      toastError('Update Failed', err.response?.data?.detail || 'Could not update trust score weights.');
      setShowConfirmActivate(false);
    },
  });

  // Calculate live sum
  const currentSum = Object.values(editingWeights).reduce((a, b) => a + Number(b || 0), 0);
  const isValidSum = Math.abs(currentSum - 100) < 0.01;

  const handleSliderChange = (factor: string, value: number) => {
    setEditingWeights((prev) => ({
      ...prev,
      [factor]: value,
    }));
  };

  const handleOpenEditor = () => {
    // Seed with latest active version or defaults
    const active = weightVersions?.find((v) => v.is_active);
    if (active && active.factors) {
      setEditingWeights({ ...active.factors });
    } else {
      setEditingWeights({ ...DEFAULT_FACTORS });
    }
    setIsEditorOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Trust Score Policy Weights</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage the council-approved factor weights driving the transparent 100-point trust score
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSuggestProposal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Suggest Weights (AI Proposal)</span>
          </button>

          <button
            type="button"
            onClick={handleOpenEditor}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md bg-primary text-white hover:bg-primary/90 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Weight Version</span>
          </button>
        </div>
      </div>

      {/* Suggest Proposal Notice */}
      {showSuggestProposal && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-3 animate-in fade-in duration-150">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-900">
                Logistic Regression Weight Proposal (Informational Only)
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowSuggestProposal(false)}
              className="text-purple-400 hover:text-purple-700"
            >
              ×
            </button>
          </div>
          <p className="text-xs text-purple-800 leading-relaxed">
            <strong>Council Governance Rule:</strong> AI-suggested weights cannot be automatically applied.
            Based on historical officer agreement rates, the regression model proposes bumping{' '}
            <code>bank_verification</code> to 25 pts and <code>document_completeness</code> to 25 pts while reducing{' '}
            <code>amount_reasonableness</code> to 5 pts. Admins must manually draft and confirm any change.
          </p>
        </div>
      )}

      {/* Interactive Weight Version Editor Modal */}
      {isEditorOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="p-5 bg-white border border-slate-300 rounded-xl shadow-lg space-y-5 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Draft New Trust Weights Version</h2>
              <p className="text-xs text-slate-500">
                Adjust factor weights. The sum of all weights must equal exactly 100 points.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                  isValidSum
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-rose-50 text-rose-800 border-rose-300'
                }`}
              >
                Sum: {currentSum} / 100 pts
              </span>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ×
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.keys(DEFAULT_FACTORS).map((factor) => {
              const val = editingWeights[factor] ?? DEFAULT_FACTORS[factor];
              return (
                <div key={factor} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <label htmlFor={`weight-${factor}`} className="font-semibold text-slate-800">
                      {FACTOR_LABELS[factor] || factor}
                    </label>
                    <span className="font-mono font-bold text-primary">{val} pts</span>
                  </div>
                  <input
                    id={`weight-${factor}`}
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={val}
                    onChange={(e) => handleSliderChange(factor, Number(e.target.value))}
                    className="w-full accent-primary h-2 bg-slate-200 rounded-lg cursor-pointer"
                  />
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              <strong>Notice:</strong> Activating a new weights version affects subsequent score computations. Historical snapshots preserve their original versions for audit reproducibility.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsEditorOpen(false)}
              className="px-3.5 py-2 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!isValidSum || updateMutation.isPending}
              onClick={() => setShowConfirmActivate(true)}
              className="px-4 py-2 text-xs font-semibold rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-50 shadow-xs"
            >
              Review & Activate Policy Version
            </button>
          </div>
        </div>
      )}

      {/* Historical Versions Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Weight Version History
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            {weightVersions?.length || 0} registered versions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Version</th>
                <th className="py-2.5 px-4">Policy Status</th>
                <th className="py-2.5 px-4">Effective Date</th>
                <th className="py-2.5 px-4">Key Factor Allocations</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Loading policy versions...
                  </td>
                </tr>
              ) : weightVersions && weightVersions.length > 0 ? (
                weightVersions.map((v) => (
                  <tr key={v.version} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-bold font-mono text-slate-900">
                      v{v.version}
                    </td>
                    <td className="py-3 px-4">
                      {v.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Active Policy</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-400">
                          Archived
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                      {v.effective_from ? new Date(v.effective_from).toLocaleDateString('en-IN') : 'Initial Seed'}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      <div className="flex flex-wrap gap-1 text-[10px]">
                        {v.factors &&
                          Object.entries(v.factors)
                            .slice(0, 4)
                            .map(([k, val]) => (
                              <span key={k} className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700">
                                {k.slice(0, 10)}: {val}pt
                              </span>
                            ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedVersion(v)}
                        className="text-primary hover:underline font-semibold"
                      >
                        Inspect Breakdown
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No weight versions loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Breakdown Drawer/Dialog */}
      {selectedVersion && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                Weight Allocations — Version {selectedVersion.version}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedVersion(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>
            <div className="space-y-2 text-xs">
              {selectedVersion.factors &&
                Object.entries(selectedVersion.factors).map(([factor, pt]) => (
                  <div key={factor} className="flex justify-between py-1 border-b border-slate-100">
                    <span className="font-medium text-slate-700 capitalize">
                      {factor.replace(/_/g, ' ')}
                    </span>
                    <span className="font-mono font-bold text-primary">{pt} pts</span>
                  </div>
                ))}
            </div>
            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setSelectedVersion(null)}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showConfirmActivate}
        title="Activate Trust Weights Version"
        message="Are you sure you wish to publish and activate this new weights configuration? All subsequent instrument risk computations will use these updated factor weights."
        confirmLabel="Publish & Activate"
        onConfirm={() => updateMutation.mutate(editingWeights)}
        onCancel={() => setShowConfirmActivate(false)}
      />
    </div>
  );
};
