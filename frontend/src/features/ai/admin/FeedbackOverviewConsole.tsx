import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  MessageSquare,
  ThumbsDown,
  ThumbsUp,
  XCircle,
  Filter,
  Search,
  Clock,
  User,
  ShieldCheck,
  Building2,
  FileSpreadsheet,
} from 'lucide-react';
import { aiApi, RewardMetric } from '../../../api/ai';
import { queryKeys } from '../../../api/queryKeys';
import { MOCK_HEALTH_STATS } from './AiHealthConsole';

export interface FeedbackLogItem {
  id: string;
  timestamp: string;
  ai_feature: string;
  instrument_ref: string;
  institution_name: string;
  officer_name: string;
  officer_role: string;
  verdict: 'CORRECT' | 'INCORRECT';
  original_ai_prediction: string;
  officer_note: string;
  consensus_status: 'CONSENSUS_REACHED' | 'QUEUED_FOR_RETRAIN' | 'RESOLVED';
}

export const MOCK_FEEDBACK_LOGS: FeedbackLogItem[] = [
  {
    id: 'fb-101',
    timestamp: '2026-10-29 16:42',
    ai_feature: 'ocr_extraction',
    instrument_ref: 'SBI-FDR-9842104',
    institution_name: 'College of Engineering Pune (COEP)',
    officer_name: 'Dr. R. K. Sharma',
    officer_role: 'Verifying Officer (VO-08)',
    verdict: 'CORRECT',
    original_ai_prediction: 'Principal: ₹1,00,00,000 | Maturity: 18 Nov 2026 | ROI: 7.25%',
    officer_note: 'Verified against SBI physical scanned receipt. All 8 fields match 100%.',
    consensus_status: 'CONSENSUS_REACHED',
  },
  {
    id: 'fb-102',
    timestamp: '2026-10-29 15:18',
    ai_feature: 'bank_slip_alignment',
    instrument_ref: 'PNB-FDR-4819203',
    institution_name: 'Delhi Technological University (DTU)',
    officer_name: 'S. K. Verma',
    officer_role: 'Verifying Officer (VO-04)',
    verdict: 'CORRECT',
    original_ai_prediction: 'Lien Tag: Marked to Member Secretary, AICTE',
    officer_note: 'Confirmed bank branch seal and joint lien wording in confirmation slip.',
    consensus_status: 'CONSENSUS_REACHED',
  },
  {
    id: 'fb-103',
    timestamp: '2026-10-29 14:05',
    ai_feature: 'trust_score_engine',
    instrument_ref: 'CNRB-FDR-3910284',
    institution_name: 'RV College of Engineering (RVCE)',
    officer_name: 'Dr. M. Lakshmi',
    officer_role: 'Verifying Officer (VO-11)',
    verdict: 'CORRECT',
    original_ai_prediction: 'Trust Score: 95/100 (Tier-1 Low Risk Profile)',
    officer_note: 'Agreed. Zero discrepancies over 4-year audit trail.',
    consensus_status: 'CONSENSUS_REACHED',
  },
  {
    id: 'fb-104',
    timestamp: '2026-10-29 11:22',
    ai_feature: 'turnaround_predictor',
    instrument_ref: 'IOB-FDR-8192038',
    institution_name: 'PSG College of Technology',
    officer_name: 'P. Venkatesh',
    officer_role: 'Approving Authority (AA-02)',
    verdict: 'CORRECT',
    original_ai_prediction: 'Predicted Turnaround: 2.1 Days',
    officer_note: 'Scrutiny completed in 1.8 days. Prediction within acceptable MAE margin.',
    consensus_status: 'CONSENSUS_REACHED',
  },
  {
    id: 'fb-105',
    timestamp: '2026-10-28 17:30',
    ai_feature: 'ocr_extraction',
    instrument_ref: 'HDFC-FDR-7718290',
    institution_name: 'Vellore Institute of Technology (VIT)',
    officer_name: 'Dr. R. K. Sharma',
    officer_role: 'Verifying Officer (VO-08)',
    verdict: 'INCORRECT',
    original_ai_prediction: 'IFSC Code: HDFC0000123 (Misread character O as 0)',
    officer_note: 'Corrected character 5 from numeric 0 to alpha O. Logged for character profile retrain.',
    consensus_status: 'QUEUED_FOR_RETRAIN',
  },
  {
    id: 'fb-106',
    timestamp: '2026-10-28 15:45',
    ai_feature: 'nl_query_parser',
    instrument_ref: 'SYSTEM-SEARCH-891',
    institution_name: 'Executive Inquiry Query',
    officer_name: 'Ananya Deshmukh',
    officer_role: 'Approving Authority (AA-01)',
    verdict: 'CORRECT',
    original_ai_prediction: 'Intent: FILTER_BY_MATURITY | Range: < 30 Days | State: Maharashtra',
    officer_note: 'Parsed complex natural language prompt into exact SQL filter predicates.',
    consensus_status: 'CONSENSUS_REACHED',
  },
  {
    id: 'fb-107',
    timestamp: '2026-10-28 12:10',
    ai_feature: 'discrepancy_classifier',
    instrument_ref: 'UCBA-FDR-1092837',
    institution_name: 'Jadavpur University',
    officer_name: 'S. K. Verma',
    officer_role: 'Verifying Officer (VO-04)',
    verdict: 'CORRECT',
    original_ai_prediction: 'Discrepancy: Expiring in 13 days without active renewal receipt',
    officer_note: 'Confirmed urgent renewal flag. Notice dispatched to institution registrar.',
    consensus_status: 'CONSENSUS_REACHED',
  },
  {
    id: 'fb-108',
    timestamp: '2026-10-27 16:50',
    ai_feature: 'turnaround_predictor',
    instrument_ref: 'SBI-FDR-4819028',
    institution_name: 'Thapar Institute of Engineering',
    officer_name: 'Dr. M. Lakshmi',
    officer_role: 'Verifying Officer (VO-11)',
    verdict: 'INCORRECT',
    original_ai_prediction: 'Predicted Turnaround: 4.5 Days',
    officer_note: 'Fast-tracked expedited clearance in 1.2 days due to pre-verified bank API link.',
    consensus_status: 'QUEUED_FOR_RETRAIN',
  },
  {
    id: 'fb-109',
    timestamp: '2026-10-27 11:35',
    ai_feature: 'ocr_extraction',
    instrument_ref: 'BARB-FDR-5510293',
    institution_name: 'MNIT Jaipur',
    officer_name: 'P. Venkatesh',
    officer_role: 'Approving Authority (AA-02)',
    verdict: 'CORRECT',
    original_ai_prediction: 'Principal: ₹1,50,00,000 | Bank: Bank of Baroda | Issue: 31 Mar 2022',
    officer_note: 'Perfect alignment across both FDR front scan and bank counterfoil.',
    consensus_status: 'CONSENSUS_REACHED',
  },
  {
    id: 'fb-110',
    timestamp: '2026-10-26 14:15',
    ai_feature: 'bank_slip_alignment',
    instrument_ref: 'UBIN-FDR-2910384',
    institution_name: 'VJTI Mumbai',
    officer_name: 'Dr. R. K. Sharma',
    officer_role: 'Verifying Officer (VO-08)',
    verdict: 'CORRECT',
    original_ai_prediction: 'Lien Marked: Yes | Authorized Signatory: Verified',
    officer_note: 'Verified signatory stamp against Union Bank of India verified specimen list.',
    consensus_status: 'CONSENSUS_REACHED',
  },
];

export const FeedbackOverviewConsole: React.FC = () => {
  const [windowDays, setWindowDays] = useState<number>(30);
  const [featureFilter, setFeatureFilter] = useState<string>('all');
  const [verdictFilter, setVerdictFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  const { data: rawStats, isLoading } = useQuery({
    queryKey: queryKeys.ai.feedbackStats(windowDays),
    queryFn: () => aiApi.getFeedbackStats(windowDays),
  });

  const stats: RewardMetric[] = useMemo(() => {
    if (rawStats && rawStats.length >= 3) {
      return rawStats;
    }
    return MOCK_HEALTH_STATS[windowDays] || MOCK_HEALTH_STATS[30];
  }, [rawStats, windowDays]);

  const filteredLogs = useMemo(() => {
    let list = [...MOCK_FEEDBACK_LOGS];

    if (featureFilter !== 'all') {
      list = list.filter((l) => l.ai_feature === featureFilter);
    }

    if (verdictFilter !== 'all') {
      list = list.filter((l) => l.verdict === verdictFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) =>
          l.instrument_ref.toLowerCase().includes(q) ||
          l.institution_name.toLowerCase().includes(q) ||
          l.officer_name.toLowerCase().includes(q) ||
          l.officer_note.toLowerCase().includes(q)
      );
    }

    return list;
  }, [featureFilter, verdictFilter, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Officer Feedback & Telemetry Audit Log</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Aggregated human feedback labels, verdicts, and granular officer correction history
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

      {/* Feature Feedback Aggregates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((metric) => {
          const agreementRate =
            metric.total_count > 0
              ? Math.round((metric.correct_count / metric.total_count) * 100)
              : 100;

          return (
            <div
              key={metric.ai_feature}
              className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                    {metric.ai_feature.replace(/_/g, ' ')}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {metric.total_count} total evaluations
                  </p>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    metric.reward >= 0
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-rose-50 text-rose-800 border-rose-300'
                  }`}
                >
                  Reward: +{metric.reward.toFixed(2)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-lg text-center text-xs">
                <div>
                  <span className="text-[10px] text-emerald-700 font-medium flex items-center justify-center gap-1">
                    <ThumbsUp className="w-3 h-3" /> Confirmed
                  </span>
                  <span className="text-sm font-bold text-emerald-700">{metric.correct_count}</span>
                </div>
                <div>
                  <span className="text-[10px] text-rose-700 font-medium flex items-center justify-center gap-1">
                    <ThumbsDown className="w-3 h-3" /> Corrected
                  </span>
                  <span className="text-sm font-bold text-rose-700">{metric.incorrect_count}</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-600 font-medium">Agreement:</span>
                  <span className="font-bold text-slate-900">{agreementRate}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${agreementRate}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Granular Feedback Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden space-y-3">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Granular Human-in-the-Loop Feedback Log ({filteredLogs.length} Records)
            </h2>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search ref, institution, officer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary w-48 sm:w-60"
              />
            </div>

            <select
              value={featureFilter}
              onChange={(e) => setFeatureFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700"
            >
              <option value="all">All AI Subsystems</option>
              <option value="ocr_extraction">OCR Extraction</option>
              <option value="bank_slip_alignment">Bank Slip Alignment</option>
              <option value="trust_score_engine">Trust Score</option>
              <option value="turnaround_predictor">Turnaround Predictor</option>
              <option value="nl_query_parser">NL Search</option>
              <option value="discrepancy_classifier">Discrepancy Classifier</option>
            </select>

            <select
              value={verdictFilter}
              onChange={(e) => setVerdictFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700"
            >
              <option value="all">All Verdicts</option>
              <option value="CORRECT">Confirmed Correct</option>
              <option value="INCORRECT">Officer Corrected</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Timestamp & Subsystem</th>
                <th className="py-2.5 px-4">Instrument Reference & Institution</th>
                <th className="py-2.5 px-4">Verifying Officer</th>
                <th className="py-2.5 px-4">Verdict</th>
                <th className="py-2.5 px-4">Original AI Output</th>
                <th className="py-2.5 px-4">Officer Audit Note</th>
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-mono text-slate-500 block text-[11px]">{log.timestamp}</span>
                    <span className="font-bold text-slate-900 capitalize text-xs">
                      {log.ai_feature.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono font-bold text-primary block">{log.instrument_ref}</span>
                    <span className="text-[11px] text-slate-600 line-clamp-1">{log.institution_name}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-900 block">{log.officer_name}</span>
                    <span className="text-[10px] text-slate-500">{log.officer_role}</span>
                  </td>
                  <td className="py-3 px-4">
                    {log.verdict === 'CORRECT' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                        <ThumbsUp className="w-3 h-3 text-emerald-600" />
                        Confirmed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-300">
                        <ThumbsDown className="w-3 h-3 text-rose-600" />
                        Corrected
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-600 text-[11px] max-w-[200px]">
                    <span className="line-clamp-2 font-mono bg-slate-50 p-1 rounded border border-slate-200">
                      {log.original_ai_prediction}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-700 text-xs max-w-[220px]">
                    <span className="line-clamp-2">{log.officer_note}</span>
                  </td>
                  <td className="py-3 px-4">
                    {log.consensus_status === 'CONSENSUS_REACHED' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                        <CheckCircle2 className="w-3 h-3" /> Consensus
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700">
                        <Clock className="w-3 h-3" /> Retrain Queue
                      </span>
                    )}
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
