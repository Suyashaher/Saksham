import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Box, CheckCircle, Database, ExternalLink, RefreshCw, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import { aiApi, AIModelResponse } from '../../../api/ai';
import { queryKeys } from '../../../api/queryKeys';
import { DataSourceBadge } from '../../../components/ui/ai/DataSourceBadge';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useToast } from '../../../components/ui/Toast';

export const ModelRegistryConsole: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [modelToPromote, setModelToPromote] = useState<AIModelResponse | null>(null);
  const [modelToRollback, setModelToRollback] = useState<AIModelResponse | null>(null);
  const [inspectMetricsModel, setInspectMetricsModel] = useState<AIModelResponse | null>(null);

  const { data: models, isLoading, refetch, isFetching } = useQuery({
    queryKey: queryKeys.ai.models,
    queryFn: aiApi.getModels,
  });

  const promoteMutation = useMutation({
    mutationFn: (modelId: string) => aiApi.promoteModel(modelId),
    onSuccess: () => {
      success('Model Promoted', 'Selected model version promoted to production champion.');
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.models });
      setModelToPromote(null);
      setModelToRollback(null);
    },
    onError: (err: any) => {
      toastError('Promotion Refused', err.response?.data?.detail || 'Could not promote model.');
      setModelToPromote(null);
      setModelToRollback(null);
    },
  });

  const formatStage = (stage: string) => {
    const norm = stage.toUpperCase();
    if (norm === 'PRODUCTION' || norm === 'CHAMPION') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
          <CheckCircle className="w-3 h-3 text-emerald-600" />
          <span>Champion (Prod)</span>
        </span>
      );
    }
    if (norm === 'STAGING' || norm === 'CHALLENGER') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-300">
          <Sparkles className="w-3 h-3 text-purple-600" />
          <span>Challenger</span>
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
        Archived
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">AI Model Registry & Governance</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Champion/challenger model deployments, synthetic evaluation metrics, and promotion controls
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh Registry</span>
          </button>
        </div>
      </div>

      {/* Governance Banner */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-slate-700 space-y-1">
          <p className="font-semibold text-slate-900">
            Model Governance & Synthetic Benchmark Standard
          </p>
          <p className="text-slate-600 leading-relaxed">
            All models undergo evaluation on holdout test sets. Models tagged with the{' '}
            <DataSourceBadge source="synthetic" showTooltip={false} /> badge were benchmarked on simulated data.
            Retraining is automatically executed weekly by Celery background workers when 100+ feedback records are gathered.
          </p>
        </div>
      </div>

      {/* Models Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-slate-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Registered Model Artifacts
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            {models?.length || 0} deployed models
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Model Name</th>
                <th className="py-2.5 px-4">Version</th>
                <th className="py-2.5 px-4">Deployment Stage</th>
                <th className="py-2.5 px-4">Data Source</th>
                <th className="py-2.5 px-4">Key Metrics</th>
                <th className="py-2.5 px-4">Trained / Registered</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Loading model registry...
                  </td>
                </tr>
              ) : models && models.length > 0 ? (
                models.map((model) => {
                  const isChampion = model.stage.toUpperCase() === 'PRODUCTION' || model.stage.toUpperCase() === 'CHAMPION';
                  const isChallenger = model.stage.toUpperCase() === 'STAGING' || model.stage.toUpperCase() === 'CHALLENGER';

                  return (
                    <tr key={model.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                        {model.model_name}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {model.version}
                      </td>
                      <td className="py-3 px-4">
                        {formatStage(model.stage)}
                      </td>
                      <td className="py-3 px-4">
                        <DataSourceBadge source={model.data_source} />
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        {model.metrics && Object.keys(model.metrics).length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setInspectMetricsModel(model)}
                            className="text-primary hover:underline"
                          >
                            {Object.entries(model.metrics)
                              .slice(0, 2)
                              .map(([k, v]) => `${k.toUpperCase()}: ${typeof v === 'number' ? v.toFixed(2) : v}`)
                              .join(' | ')}
                          </button>
                        ) : (
                          <span className="text-slate-400 italic">None logged</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {model.trained_at ? new Date(model.trained_at).toLocaleDateString('en-IN') : '2026-10-27'}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {isChallenger && (
                          <button
                            type="button"
                            onClick={() => setModelToPromote(model)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-primary text-white hover:bg-primary/90 shadow-2xs"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            <span>Promote</span>
                          </button>
                        )}

                        {!isChampion && !isChallenger && (
                          <button
                            type="button"
                            onClick={() => setModelToRollback(model)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-100"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Rollback To</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No models registered in registry mirror.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Metrics Dialog */}
      {inspectMetricsModel && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  {inspectMetricsModel.model_name} ({inspectMetricsModel.version})
                </h3>
                <p className="text-xs text-slate-500">Holdout evaluation metrics</p>
              </div>
              <button
                type="button"
                onClick={() => setInspectMetricsModel(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {inspectMetricsModel.metrics &&
                Object.entries(inspectMetricsModel.metrics).map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="font-semibold text-slate-700 uppercase">{k}</span>
                    <span className="font-mono font-bold text-primary">
                      {typeof v === 'number' ? v.toFixed(3) : String(v)}
                    </span>
                  </div>
                ))}
            </div>

            <div className="p-2.5 bg-violet-50 rounded-lg text-[11px] text-violet-800 border border-violet-200">
              <span className="font-semibold">Benchmarking source:</span>{' '}
              {inspectMetricsModel.data_source} dataset. Not actual production performance.
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setInspectMetricsModel(null)}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promote Confirmation Dialog */}
      {modelToPromote && (
        <ConfirmDialog
          isOpen={!!modelToPromote}
          title="Promote Model to Champion"
          message={`Are you sure you want to promote ${modelToPromote.model_name} version ${modelToPromote.version} to Production Champion? The current champion will be archived.`}
          confirmLabel="Promote to Production"
          onConfirm={() => promoteMutation.mutate(modelToPromote.id)}
          onCancel={() => setModelToPromote(null)}
        />
      )}

      {/* Rollback Confirmation Dialog */}
      {modelToRollback && (
        <ConfirmDialog
          isOpen={!!modelToRollback}
          title="Rollback Model Version"
          message={`Are you sure you wish to rollback ${modelToRollback.model_name} to previous version ${modelToRollback.version}?`}
          confirmLabel="Execute Rollback"
          onConfirm={() => promoteMutation.mutate(modelToRollback.id)}
          onCancel={() => setModelToRollback(null)}
        />
      )}
    </div>
  );
};
