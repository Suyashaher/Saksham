import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Flag, RefreshCw, Shield, Sparkles } from 'lucide-react';
import { aiApi, TrustScoreResponse } from '../../../api/ai';
import { queryKeys } from '../../../api/queryKeys';
import { DataSourceBadge } from '../../../components/ui/ai/DataSourceBadge';
import { FeedbackButtons } from '../../../components/ui/ai/FeedbackButtons';
import { AiUnavailable } from '../../../components/ui/ai/AiUnavailable';
import { useAiConfig } from '../../../components/ui/ai/AiProvider';

export interface TrustInsightsCardProps {
  instrumentId: string;
  className?: string;
}

export const TrustInsightsCard: React.FC<TrustInsightsCardProps> = ({
  instrumentId,
  className = '',
}) => {
  const { isFeatureEnabled } = useAiConfig();

  const { data: trustData, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.ai.trustScore(instrumentId),
    queryFn: () => aiApi.getTrustScore(instrumentId, false),
    enabled: isFeatureEnabled('trust_score') && !!instrumentId,
    staleTime: 60 * 1000,
  });

  if (!isFeatureEnabled('trust_score')) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="p-6 bg-white border border-slate-200 rounded-xl animate-pulse space-y-4">
        <div className="h-5 bg-slate-200 rounded w-1/4" />
        <div className="h-12 bg-slate-100 rounded w-full" />
        <div className="h-40 bg-slate-100 rounded w-full" />
      </div>
    );
  }

  if (isError || !trustData) {
    return <AiUnavailable featureName="Trust Score Insights" />;
  }

  const { score, band, factors, weights_version, model_version, data_source } = trustData;

  let bandLabel = 'Low risk (Routine Processing)';
  let bandBadge = 'bg-emerald-50 text-emerald-800 border-emerald-300';
  let gaugeColor = 'text-emerald-600';
  let Icon = CheckCircle2;

  if (score < 50 || band === 'LOW') {
    bandLabel = 'High priority (Detailed Scrutiny Required)';
    bandBadge = 'bg-red-50 text-red-800 border-red-300';
    gaugeColor = 'text-red-600';
    Icon = Flag;
  } else if (score < 80 || band === 'MEDIUM') {
    bandLabel = 'Needs review (Closer Scrutiny Recommended)';
    bandBadge = 'bg-amber-50 text-amber-800 border-amber-300';
    gaugeColor = 'text-amber-600';
    Icon = AlertCircle;
  }

  return (
    <div className={`bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden space-y-5 p-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Transparent Trust & Risk Score
              </h3>
              <DataSourceBadge source={data_source} />
            </div>
            <p className="text-xs text-slate-500">
              Deterministic 10-factor weighted model evaluated against verified bank & document facts
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          title="Recompute score with latest verified attributes"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Recompute Score</span>
        </button>
      </div>

      {/* Score Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 items-center">
        {/* Score Gauge / Number */}
        <div className="flex items-center gap-4 md:border-r border-slate-200 pr-4">
          <div className="relative flex items-center justify-center w-20 h-20 rounded-full border-4 border-slate-200 bg-white shadow-xs shrink-0">
            <span className={`text-2xl font-black ${gaugeColor}`}>{score}</span>
            <span className="text-[10px] text-slate-400 font-bold absolute bottom-2">/100</span>
          </div>
          <div>
            <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${bandBadge}`}>
              <Icon className="w-3.5 h-3.5" />
              <span>{band} Band</span>
            </div>
            <p className="text-xs font-medium text-slate-700 mt-1">{bandLabel}</p>
          </div>
        </div>

        {/* Model & Version Details */}
        <div className="space-y-1 text-xs text-slate-600 md:col-span-2">
          <p>
            <strong className="text-slate-800">Weights Version: </strong>
            <span className="font-mono">v{weights_version} (Active Council Policy)</span>
          </p>
          <p>
            <strong className="text-slate-800">Scoring Engine: </strong>
            <span className="font-mono">{model_version}</span>
          </p>
          <p className="text-slate-500 text-[11px] leading-relaxed">
            * Human Decision Integrity: This score assists officer scrutiny queues. It cannot automatically approve, reject, or alter this instrument.
          </p>
        </div>
      </div>

      {/* Factors Breakdown Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Factor Contribution Breakdown (100-Point Scale)
          </h4>
          <span className="text-[11px] text-slate-500">
            Sum of Factor Contributions = Score
          </span>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Evaluation Factor</th>
                <th className="py-2.5 px-3">Weight</th>
                <th className="py-2.5 px-3">Normalized</th>
                <th className="py-2.5 px-3">Contribution</th>
                <th className="py-2.5 px-3">Reason / Audit Trail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {factors.map((factor) => (
                <tr key={factor.name} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-slate-800 capitalize">
                    {factor.name.replace(/_/g, ' ')}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">{factor.weight} pts</td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">
                    {(factor.normalized * 100).toFixed(0)}%
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                    +{factor.contribution.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 leading-snug">
                    {factor.reason || 'Verified through standard criteria.'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Feedback Section */}
      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <FeedbackButtons
          feature="trust_score"
          entityId={instrumentId}
          outputRef={trustData as any}
          modelVersion={`weights-v${weights_version}`}
          label="Is this Trust Score accurate?"
        />
        <span className="text-[11px] text-slate-400">
          Officer feedback tunes future policy weights via Admin Console
        </span>
      </div>
    </div>
  );
};
