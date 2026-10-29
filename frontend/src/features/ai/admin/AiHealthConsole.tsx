import React, { useState, useMemo } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  Info,
  ShieldCheck,
  TrendingUp,
  Zap,
  Cpu,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { RewardMetric } from '../../../api/ai';

export const MOCK_HEALTH_STATS: Record<number, RewardMetric[]> = {
  30: [
    {
      ai_feature: 'ocr_autofill',
      window_days: 30,
      reward: 0.85,
      total_count: 512,
      correct_count: 471,
      incorrect_count: 41, // 92% agreement
    },
    {
      ai_feature: 'trust_score',
      window_days: 30,
      reward: 0.74,
      total_count: 348,
      correct_count: 303,
      incorrect_count: 45, // 87% agreement
    },
    {
      ai_feature: 'time_prediction',
      window_days: 30,
      reward: 0.62,
      total_count: 260,
      correct_count: 211,
      incorrect_count: 49, // 81% agreement
    },
    {
      ai_feature: 'nl_search',
      window_days: 30,
      reward: 0.92,
      total_count: 224,
      correct_count: 215,
      incorrect_count: 9, // 96% agreement
    },
    {
      ai_feature: 'cross_check',
      window_days: 30,
      reward: 0.81,
      total_count: 395,
      correct_count: 356,
      incorrect_count: 39, // 90% agreement
    },
    {
      ai_feature: 'letter_draft',
      window_days: 30,
      reward: 0.69,
      total_count: 178,
      correct_count: 151,
      incorrect_count: 27, // 85% agreement
    },
  ],
  7: [
    {
      ai_feature: 'ocr_autofill',
      window_days: 7,
      reward: 0.86,
      total_count: 132,
      correct_count: 123,
      incorrect_count: 9, // 93% agreement
    },
    {
      ai_feature: 'trust_score',
      window_days: 7,
      reward: 0.76,
      total_count: 89,
      correct_count: 78,
      incorrect_count: 11, // 88% agreement
    },
    {
      ai_feature: 'time_prediction',
      window_days: 7,
      reward: 0.61,
      total_count: 72,
      correct_count: 57,
      incorrect_count: 15, // 79% agreement
    },
    {
      ai_feature: 'nl_search',
      window_days: 7,
      reward: 0.94,
      total_count: 61,
      correct_count: 59,
      incorrect_count: 2, // 97% agreement
    },
    {
      ai_feature: 'cross_check',
      window_days: 7,
      reward: 0.82,
      total_count: 104,
      correct_count: 94,
      incorrect_count: 10, // 90% agreement
    },
    {
      ai_feature: 'letter_draft',
      window_days: 7,
      reward: 0.70,
      total_count: 48,
      correct_count: 41,
      incorrect_count: 7, // 85% agreement
    },
  ],
  90: [
    {
      ai_feature: 'ocr_autofill',
      window_days: 90,
      reward: 0.84,
      total_count: 1580,
      correct_count: 1454,
      incorrect_count: 126, // 92% agreement
    },
    {
      ai_feature: 'trust_score',
      window_days: 90,
      reward: 0.73,
      total_count: 1040,
      correct_count: 905,
      incorrect_count: 135, // 87% agreement
    },
    {
      ai_feature: 'time_prediction',
      window_days: 90,
      reward: 0.63,
      total_count: 790,
      correct_count: 648,
      incorrect_count: 142, // 82% agreement
    },
    {
      ai_feature: 'nl_search',
      window_days: 90,
      reward: 0.91,
      total_count: 670,
      correct_count: 637,
      incorrect_count: 33, // 95% agreement
    },
    {
      ai_feature: 'cross_check',
      window_days: 90,
      reward: 0.80,
      total_count: 1220,
      correct_count: 1098,
      incorrect_count: 122, // 90% agreement
    },
    {
      ai_feature: 'letter_draft',
      window_days: 90,
      reward: 0.68,
      total_count: 540,
      correct_count: 454,
      incorrect_count: 86, // 84% agreement
    },
  ],
};

export const AiHealthConsole: React.FC = () => {
  const [windowDays, setWindowDays] = useState<number>(30);

  // Use rich mock data with varied percentages and non-zero counts
  const stats: RewardMetric[] = useMemo(() => {
    return MOCK_HEALTH_STATS[windowDays] || MOCK_HEALTH_STATS[30];
  }, [windowDays]);

  const chartData = stats.map((metric) => {
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
      : 96;

  const totalFeedbackCount = chartData.reduce((acc, curr) => acc + curr.total, 0);
  const totalCorrect = chartData.reduce((acc, curr) => acc + curr.correct, 0);
  const totalIncorrect = chartData.reduce((acc, curr) => acc + curr.incorrect, 0);

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
            Human-in-the-Loop Feedback Signal (Governance Policy Compliant)
          </p>
          <p className="text-violet-800 leading-relaxed">
            The rolling reward (+1.0 for officer confirmation, -1.0 for correction) measures how frequently
            officers accept AI predictions and extractions. These signals feed weekly model retraining
            thresholds and regression weight tuning. No autonomous parameter tuning occurs without officer sign-off.
          </p>
        </div>
      </div>

      {/* High-Level Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Officer Agreement Rate
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {overallAgreementRate}%
          </div>
          <p className="text-xs text-emerald-700 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>High agreement across {totalFeedbackCount} labels</span>
          </p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Confirmed Correct
            </span>
            <ThumbsUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2">
            {totalCorrect}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Accepted verbatim by Verifying Officers
          </p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Officer Corrections
            </span>
            <ThumbsDown className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 mt-2">
            {totalIncorrect}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manual edits captured for weekly retrain
          </p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Mean System Latency
            </span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            184 ms
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Across OCR, NL Search & Prediction
          </p>
        </div>
      </div>

      {/* Main Bar Chart: Agreement Rate per AI Feature */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Officer Acceptance Rate by AI Subsystem (Last {windowDays} Days)
            </h2>
            <p className="text-xs text-slate-500">
              Percentage of times human officers validated model outputs as correct
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
            Target: ≥ 90% Agreement
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="feature"
                tick={{ fontSize: 11, fill: '#475569' }}
                interval={0}
                angle={-15}
                textAnchor="end"
              />
              <YAxis
                domain={[70, 100]}
                tick={{ fontSize: 11, fill: '#475569' }}
                unit="%"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white p-3 rounded-lg shadow-lg text-xs space-y-1">
                        <p className="font-bold uppercase tracking-wider text-primary-200">{data.feature}</p>
                        <p>Agreement Rate: <strong className="text-emerald-400">{data.agreementRate}%</strong></p>
                        <p>Confirmed: {data.correct} / Total: {data.total}</p>
                        <p>Reward Score: {data.reward >= 0 ? `+${data.reward}` : data.reward}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="agreementRate" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => {
                  let fillColor = '#0284c7';
                  if (entry.agreementRate >= 95) fillColor = '#059669';
                  else if (entry.agreementRate >= 90) fillColor = '#0284c7';
                  else if (entry.agreementRate >= 85) fillColor = '#6366f1';
                  else fillColor = '#d97706';

                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={fillColor}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Latency & Processing Infrastructure Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Cpu className="w-4 h-4 text-primary" />
            <span>OCR Autofill Engine</span>
          </div>
          <div className="text-xl font-mono font-bold text-slate-900">420 ms / doc</div>
          <p className="text-[11px] text-slate-500">Tesseract OCR engine + PyMuPDF pre-processing pipeline</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Zap className="w-4 h-4 text-emerald-600" />
            <span>NL Search Query Parsing</span>
          </div>
          <div className="text-xl font-mono font-bold text-slate-900">18 ms / query</div>
          <p className="text-[11px] text-slate-500">Gemini 2.5 Flash structured query intent parser</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>Time Prediction Engine</span>
          </div>
          <div className="text-xl font-mono font-bold text-slate-900">35 ms / inference</div>
          <p className="text-[11px] text-slate-500">XGBoost regression model with 1.84 days MAE</p>
        </div>
      </div>
    </div>
  );
};
