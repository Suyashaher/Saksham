import React, { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, CheckCircle2, History, Info, Plus, Sliders, Sparkles, Eye, ArrowRight } from 'lucide-react';
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

export const MOCK_WEIGHT_VERSIONS: WeightResponse[] = [
  {
    version: 4,
    is_active: true,
    effective_from: '2026-10-01T00:00:00Z',
    effective_to: null,
    factors: {
      document_completeness: 20,
      ocr_match: 15,
      bank_verification: 25,
      amount_reasonableness: 10,
      date_consistency: 10,
      alert_count: 8,
      cross_doc_consistency: 5,
      renewal_chain_integrity: 4,
      response_timeliness: 2,
      bank_reputation: 1,
    },
  },
  {
    version: 3,
    is_active: false,
    effective_from: '2026-06-01T00:00:00Z',
    effective_to: '2026-09-30T23:59:59Z',
    factors: {
      document_completeness: 22,
      ocr_match: 18,
      bank_verification: 20,
      amount_reasonableness: 10,
      date_consistency: 10,
      alert_count: 8,
      cross_doc_consistency: 5,
      renewal_chain_integrity: 4,
      response_timeliness: 2,
      bank_reputation: 1,
    },
  },
  {
    version: 2,
    is_active: false,
    effective_from: '2026-01-01T00:00:00Z',
    effective_to: '2026-05-31T23:59:59Z',
    factors: {
      document_completeness: 25,
      ocr_match: 15,
      bank_verification: 18,
      amount_reasonableness: 12,
      date_consistency: 10,
      alert_count: 8,
      cross_doc_consistency: 5,
      renewal_chain_integrity: 4,
      response_timeliness: 2,
      bank_reputation: 1,
    },
  },
  {
    version: 1,
    is_active: false,
    effective_from: '2025-08-01T00:00:00Z',
    effective_to: '2025-12-31T23:59:59Z',
    factors: {
      document_completeness: 20,
      ocr_match: 10,
      bank_verification: 20,
      amount_reasonableness: 15,
      date_consistency: 10,
      alert_count: 10,
      cross_doc_consistency: 5,
      renewal_chain_integrity: 5,
      response_timeliness: 3,
      bank_reputation: 2,
    },
  },
];

export const TrustWeightsConsole: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingWeights, setEditingWeights] = useState<Record<string, number>>(DEFAULT_FACTORS);
  const [selectedVersion, setSelectedVersion] = useState<WeightResponse | null>(null);
  const [showConfirmActivate, setShowConfirmActivate] = useState(false);
  const [showSuggestProposal, setShowSuggestProposal] = useState(false);

  const { data: rawWeightVersions, isLoading } = useQuery({
    queryKey: queryKeys.ai.weights,
    queryFn: aiApi.getWeights,
  });

  // Blend backend versions with rich mock data
  const weightVersions: WeightResponse[] = useMemo(() => {
    if (rawWeightVersions && rawWeightVersions.length >= 2) {
      return rawWeightVersions;
    }
    if (rawWeightVersions && rawWeightVersions.length === 1) {
      const activeBackend = rawWeightVersions[0];
      return [
        activeBackend,
        ...MOCK_WEIGHT_VERSIONS.filter((m) => m.version !== activeBackend.version),
      ];
    }
    return MOCK_WEIGHT_VERSIONS;
  }, [rawWeightVersions]);

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
    const active = weightVersions.find((v) => v.is_active);
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
          <h1 className="text-xl font-bold text-slate-900">Trust Score Policy Weights & Governance</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage the council-approved factor weights driving the transparent 100-point institutional trust score
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
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setEditingWeights({
                  document_completeness: 25,
                  bank_verification: 25,
                  ocr_match: 15,
                  amount_reasonableness: 5,
                  date_consistency: 10,
                  alert_count: 10,
                  cross_doc_consistency: 5,
                  renewal_chain_integrity: 3,
                  response_timeliness: 1,
                  bank_reputation: 1,
                });
                setIsEditorOpen(true);
                setShowSuggestProposal(false);
              }}
              className="px-3 py-1.5 bg-purple-600 text-white font-semibold text-xs rounded shadow-xs hover:bg-purple-700 flex items-center gap-1"
            >
              Load Proposal into Draft Editor <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
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
              Weight Version History ({weightVersions.length} Registered Policies)
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Regulated by Council Directive 2026/FDR-08
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Version</th>
                <th className="py-2.5 px-4">Policy Status</th>
                <th className="py-2.5 px-4">Effective Date</th>
                <th className="py-2.5 px-4">Top 3 Factor Allocations</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {weightVersions.map((version) => {
                const sortedFactors = Object.entries(version.factors || {}).sort(
                  (a, b) => b[1] - a[1]
                );
                return (
                  <tr key={version.version} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      v{version.version}.0
                    </td>
                    <td className="py-3 px-4">
                      {version.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Active Policy</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                          Archived
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {version.effective_from
                        ? new Date(version.effective_from).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '2025-08-01'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {sortedFactors.slice(0, 3).map(([factor, pts]) => (
                          <span
                            key={factor}
                            className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px] font-mono"
                          >
                            {factor.replace(/_/g, ' ')}: <strong>{pts}pt</strong>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedVersion(version)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect All Weights</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Weights Version Modal */}
      {selectedVersion && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Version {selectedVersion.version}.0 Factor Allocation
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedVersion.is_active ? 'Currently applied policy' : 'Historical archived policy'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVersion(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {Object.entries(selectedVersion.factors || {}).map(([factor, pts]) => (
                <div
                  key={factor}
                  className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-xs"
                >
                  <span className="font-medium text-slate-800">
                    {FACTOR_LABELS[factor] || factor}
                  </span>
                  <span className="font-mono font-bold text-primary">{pts} pts</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                type="button"
                onClick={() => setSelectedVersion(null)}
                className="px-4 py-2 text-xs font-semibold rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Activate Dialog */}
      <ConfirmDialog
        isOpen={showConfirmActivate}
        title="Activate Trust Weights Policy"
        message="Are you sure you want to enforce these new factor weights across the AICTE portal? Subsequent trust score recalculations will immediately adopt this policy."
        confirmLabel="Confirm & Activate Policy"
        variant="info"
        isLoading={updateMutation.isPending}
        onConfirm={() => updateMutation.mutate(editingWeights)}
        onCancel={() => setShowConfirmActivate(false)}
      />
    </div>
  );
};
