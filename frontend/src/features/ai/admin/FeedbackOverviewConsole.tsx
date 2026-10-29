import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, MessageSquare, ThumbsDown, ThumbsUp, XCircle } from 'lucide-react';
import { aiApi } from '../../../api/ai';
import { queryKeys } from '../../../api/queryKeys';
import { DataSourceBadge } from '../../../components/ui/ai/DataSourceBadge';

export const FeedbackOverviewConsole: React.FC = () => {
  const [windowDays, setWindowDays] = useState<number>(30);

  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.ai.feedbackStats(windowDays),
    queryFn: () => aiApi.getFeedbackStats(windowDays),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Officer Feedback Analytics</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Aggregated human feedback labels, verdicts, and corrections per AI subsystem
          </p>
        </div>

        {/* Window Selector */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg text-xs">
          <span className="text-slate-500 font-semibold px-2">Window:</span>
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setWindowDays(days)}
              className={`px-3 py-1 font-semibold rounded-md transition-colors ${
                windowDays === days
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last {days} Days
            </button>
          ))}
        </div>
      </div>

      {/* Feature Feedback Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 col-span-2">
            Loading feedback metrics...
          </div>
        ) : stats && stats.length > 0 ? (
          stats.map((metric) => {
            const agreementRate =
              metric.total_count > 0
                ? Math.round((metric.correct_count / metric.total_count) * 100)
                : 100;

            return (
              <div
                key={metric.ai_feature}
                className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 capitalize">
                      {metric.ai_feature.replace(/_/g, ' ')}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 font-mono">
                      Subsystem: {metric.ai_feature}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${
                      metric.reward >= 0
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-rose-50 text-rose-800 border-rose-300'
                    }`}
                  >
                    Reward: {metric.reward >= 0 ? `+${metric.reward.toFixed(2)}` : metric.reward.toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-lg text-center text-xs">
                  <div>
                    <span className="text-[11px] text-slate-500 font-medium block">Total Labels</span>
                    <span className="text-base font-bold text-slate-900">{metric.total_count}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-emerald-700 font-medium flex items-center justify-center gap-1">
                      <ThumbsUp className="w-3 h-3" /> Correct
                    </span>
                    <span className="text-base font-bold text-emerald-700">{metric.correct_count}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-rose-700 font-medium flex items-center justify-center gap-1">
                      <ThumbsDown className="w-3 h-3" /> Incorrect
                    </span>
                    <span className="text-base font-bold text-rose-700">{metric.incorrect_count}</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 font-medium">Officer Acceptance:</span>
                    <span className="font-bold text-slate-900">{agreementRate}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${agreementRate}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center text-slate-400 col-span-2 bg-white rounded-xl border border-slate-200">
            No feedback telemetry collected in this period.
          </div>
        )}
      </div>
    </div>
  );
};
