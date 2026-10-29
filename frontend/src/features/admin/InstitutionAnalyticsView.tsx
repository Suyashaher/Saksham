import React, { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Building2,
  ArrowLeft,
  Calendar,
  Clock,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  DollarSign,
  Award,
  MapPin,
  Mail,
  Phone,
  Landmark,
  BadgeCheck,
  ExternalLink,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { formatINR, formatDateIST } from '../../utils/formatters';
import { MOCK_INSTITUTIONS, InstitutionRecord } from './AdminInstitutions';

export const InstitutionAnalyticsView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success } = useToast();

  const institution: InstitutionRecord = useMemo(() => {
    const found = MOCK_INSTITUTIONS.find(
      (inst) => inst.id === id || inst.aicte_id === id
    );
    return found || MOCK_INSTITUTIONS[0];
  }, [id]);

  const getStatusBadge = (status: InstitutionRecord['compliance_status']) => {
    switch (status) {
      case 'COMPLIANT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Compliant & Verified</span>
          </span>
        );
      case 'EXPIRING_SOON':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Maturity Approaching (&lt;30 Days)</span>
          </span>
        );
      case 'RENEWAL_PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Renewal Due Action Required</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const elapsedPercent = Math.max(
    10,
    Math.min(95, 100 - (institution.days_to_maturity / 1825) * 100)
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={`${institution.name}`}
        subtitle={`Institutional Fixed Deposit Portfolio, Maturity Risk Horizon & AI Compliance Analytics`}
        breadcrumbs={[
          { label: 'Home', path: '/' },
          { label: 'Administration' },
          { label: 'Institutions', path: '/admin/institutions' },
          { label: institution.aicte_id },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => navigate('/admin/institutions')}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back to Institutions
            </Button>
            <Button
              variant="black"
              size="md"
              onClick={() => {
                success(
                  'Audit Dossier Generated',
                  `Official AICTE Dossier downloaded for ${institution.name}`
                );
              }}
              leftIcon={<FileText className="w-4 h-4" />}
            >
              Export Full Dossier
            </Button>
          </div>
        }
      />

      {/* Institutional Profile Header Card */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  AICTE ID: {institution.aicte_id}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  {institution.accreditation || 'NAAC Accredited Institute'}
                </span>
              </div>
              <h1 className="text-lg font-bold text-slate-900 mt-1">{institution.name}</h1>
            </div>
          </div>

          <div>{getStatusBadge(institution.compliance_status)}</div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="line-clamp-1">{institution.address || `${institution.city}, ${institution.state}`}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="truncate">{institution.contact_email}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-slate-400 shrink-0" />
            <span>{institution.contact_phone || '+91 11 2958 1000'}</span>
          </div>
        </div>
      </div>

      {/* Executive KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Security Deposit
            </span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">
            {formatINR(institution.total_fdr_amount)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Across {institution.fdr_count} active instrument{institution.fdr_count > 1 ? 's' : ''}
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Earliest Maturity Date
            </span>
            <Calendar className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {formatDateIST(institution.earliest_maturity_date)}
          </p>
          <p className="text-[11px] font-bold text-amber-700 mt-0.5 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{institution.days_to_maturity} days remaining</span>
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              AI Trust Score
            </span>
            <ShieldCheck className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-primary mt-2">
            {institution.trust_score} / 100
          </p>
          <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
            Tier-1 High Reliability Index
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Primary Depository Bank
            </span>
            <Landmark className="w-4 h-4 text-slate-700" />
          </div>
          <p className="text-xl font-bold text-slate-900 mt-2 truncate">
            {institution.primary_bank}
          </p>
          <p className="text-[11px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
            <BadgeCheck className="w-3.5 h-3.5" />
            <span>100% Lien Marked to AICTE</span>
          </p>
        </div>
      </div>

      {/* Tenor & Maturity Horizon Progress */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-bold text-slate-900">
              5-Year Fixed Deposit Tenor & Maturity Horizon
            </h2>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            Matures on {formatDateIST(institution.earliest_maturity_date)} ({institution.days_to_maturity} days remaining)
          </span>
        </div>

        <div className="space-y-2">
          <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden flex border border-slate-200">
            <div
              className="bg-primary h-full transition-all"
              style={{ width: `${elapsedPercent}%` }}
              title="Elapsed Tenor"
            />
            <div
              className="bg-amber-400 h-full transition-all"
              style={{ width: `${100 - elapsedPercent}%` }}
              title="Remaining Horizon"
            />
          </div>

          <div className="flex justify-between text-xs text-slate-500 font-medium pt-1">
            <span>Inception (5-Year Lock-in)</span>
            <span className="font-bold text-amber-800">
              {institution.days_to_maturity <= 30
                ? '⚠️ Automated renewal notification sent to Registrar'
                : '✅ Active Lock-in: Zero early liquidation flags'}
            </span>
            <span>Maturity: {formatDateIST(institution.earliest_maturity_date)}</span>
          </div>
        </div>
      </div>

      {/* Active Fixed Deposit Instruments Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden space-y-3">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Active Fixed Deposit Instruments ({institution.instruments.length})
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Joint account held in favor of Member Secretary, AICTE
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-4">FDR Number</th>
                <th className="py-3 px-4">Bank & Branch</th>
                <th className="py-3 px-4">Principal Amount</th>
                <th className="py-3 px-4">Interest Rate</th>
                <th className="py-3 px-4">Issue Date</th>
                <th className="py-3 px-4">Maturity Date</th>
                <th className="py-3 px-4">Lien Status</th>
                <th className="py-3 px-4">OCR Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {institution.instruments.map((inst) => (
                <tr key={inst.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-primary">
                    {inst.fdr_number}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-900 block">{inst.bank_name}</span>
                    <span className="text-[11px] text-slate-500">{inst.branch}</span>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {formatINR(inst.principal_amount)}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700">
                    {inst.interest_rate}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {formatDateIST(inst.issue_date)}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900">
                    {formatDateIST(inst.maturity_date)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Lien Marked
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                    {inst.ocr_confidence}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Trust Factor Breakdown Grid */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Award className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-bold text-slate-900">
            Explainable AI Trust Diagnostics & Verification Breakdown
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
            <span className="text-slate-500 text-[11px] uppercase font-semibold block">
              Document Completeness
            </span>
            <span className="font-bold text-emerald-700 text-lg block">20 / 20 pts</span>
            <span className="text-[11px] text-slate-500 block">
              FDR Front, Bank Counterfoil, & Letter present
            </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
            <span className="text-slate-500 text-[11px] uppercase font-semibold block">
              Bank API Direct Match
            </span>
            <span className="font-bold text-emerald-700 text-lg block">25 / 25 pts</span>
            <span className="text-[11px] text-slate-500 block">
              Instant core banking API lien verification
            </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
            <span className="text-slate-500 text-[11px] uppercase font-semibold block">
              Tenor & Date Consistency
            </span>
            <span className="font-bold text-emerald-700 text-lg block">10 / 10 pts</span>
            <span className="text-[11px] text-slate-500 block">
              Issue, maturity, and 5-yr period align
            </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
            <span className="text-slate-500 text-[11px] uppercase font-semibold block">
              Discrepancy History
            </span>
            <span className="font-bold text-emerald-700 text-lg block">0 Flags</span>
            <span className="text-[11px] text-slate-500 block">
              Clean regulatory standing across all inspections
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
