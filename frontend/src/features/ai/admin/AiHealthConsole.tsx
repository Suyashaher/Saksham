import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertCircle, BarChart3, CheckCircle2, Clock, Info, ShieldCheck, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { aiApi, RewardMetric } from '../../../api/ai';
import { queryKeys } from '../../../api/queryKeys';

export const AiHealthConsole: React.FC = () => {
  const [windowDays, setWindowDays] = useState<number>(30);

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: queryKeys.ai.feedbackStats(windowDays),
    queryFn: () => aiApi.getFeedbackStats(windowDays),
  });

  const chartData = (stats || []).map((metric) => {
    const agreementRate = metric.total_count > 0 ? (metric.correct_count / metric.total_count) * 100 : 100;
    return {
      feature: metric.ai_feature.replace(/_/g, ' '),
      reward: Number(metric.reward.toFixed(2)),
      agreementRate: Math.round(agreementRate),
      total: metric.total_count,
      correct: metric.correct_count,
      incorrect: metric.incorrect_count,
    };
  });

  const overallAgreementRate =
    chartData.length > 0
      ? Math.round(
          chartData.reduce((acc, curr) => acc + curr.agreementRate, 0) / chartData.length
        )
      : 100;

  const totalFeedbackCount = chartData.reduce((acc, curr) => acc + curr.total, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">AI Health & Feedback Monitoring</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Human-in-the-loop quality signals, rolling agreement rates, and accuracy rewards
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

      {/* Explanatory Banner */}
      <div className="p-4 bg-violet-50/60 border border-violet-200 rounded-xl flex items-start gap-3">
        <Info className="w-5 h-5 text-violet-700 shrink-0 mt-0.5" />
        <div className="text-xs text-violet-900 space-y-1">
          <p className="font-semibold">
            Human-in-the-Loop Feedback Signal (Not Autonomous Reinforcement Learning)
          </p>
          <p className="text-violet-800 leading-relaxed">
            The rolling reward (+1.0 for officer confirmation, -1.0 for correction) measures how frequently
            officers accept AI predictions and extractions. These signals feed weekly model retraining
            thresholds and regression weight tuning. No autonomous parameter tuning occurs without officer sign-off.
          </p>
        </div>
      </div>

      {/* High-Level Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Officer Agreement Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {overallAgreementRate}%
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Average across active features</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Collected Officer Labels</span>
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {totalFeedbackCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Samples over last {windowDays} days</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Retraining Pipeline Status</span>
            <Clock className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-sm font-bold text-slate-900 mt-2 font-mono">
            {totalFeedbackCount >= 100 ? 'Ready for retraining' : `Accumulating (${totalFeedbackCount}/100)`}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Weekly Celery background cadence</p>
        </div>
      </div>

      {/* Rolling Reward Chart */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Rolling Reward Metric by Feature (-1.0 to +1.0)
            </h2>
            <p className="text-[11px] text-slate-500">
              Positive values indicate strong officer agreement; negative values prompt factor recalibration.
            </p>
          </div>
        </div>

        <div className="h-64 w-full">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              Loading reward telemetry...
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="feature" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis domain={[-1, 1]} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip
                  formatter={(val: any) => [`${val}`, 'Reward']}
                  contentStyle={{ backgroundColor: '#0F172A', color: '#F8FAFC', borderRadius: '8px', fontSize: '11px' }}
                />
                <Bar dataKey="reward" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.reward >= 0 ? '#10B981' : '#EF4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              No feedback collected in the selected window.
            </div>
          )}
        </div>
      </div>

      {/* Accessible Tabular Alternative (WCAG 2.1 AA) */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Feature Feedback Metrics Table (Text Alternative)
          </h3>
          <span className="text-[11px] text-slate-500">Accessible tabular representation</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">AI Capability</th>
                <th className="py-2.5 px-4">Rolling Reward</th>
                <th className="py-2.5 px-4">Officer Agreement</th>
                <th className="py-2.5 px-4">Accepted Labels</th>
                <th className="py-2.5 px-4">Corrected Labels</th>
                <th className="py-2.5 px-4">Total Submissions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {chartData.map((row) => (
                <tr key={row.feature} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-800 capitalize">
                    {row.feature}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold">
                    <span className={row.reward >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                      {row.reward >= 0 ? `+${row.reward.toFixed(2)}` : row.reward.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700">
                    {row.agreementRate}%
                  </td>
                  <td className="py-3 px-4 font-mono text-emerald-700 font-medium">
                    {row.correct}
                  </td>
                  <td className="py-3 px-4 font-mono text-rose-700 font-medium">
                    {row.incorrect}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">
                    {row.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
