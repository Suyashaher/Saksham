import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquare,
  ShieldCheck,
  Eye,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  Building,
  Clock,
  X,
  TrendingUp,
  AlertCircle,
  Search,
} from 'lucide-react';
import { apiClient, formatApiError } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { formatDateIST, formatINR, getDaysRemaining } from '../../utils/formatters';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { InstrumentTypeBadge } from '../../components/ui/InstrumentTypeBadge';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { VerificationTag } from '../../components/ui/VerificationTag';
import { useToast } from '../../components/ui/Toast';

interface VerifiedInstrumentItem {
  id: string;
  reference_number: string;
  instrument_type: string;
  issuing_bank: string;
  branch?: string | null;
  amount: string;
  required_amount?: string | null;
  issue_date: string;
  maturity_date: string;
  status: string;
  verification_tag?: string;
  created_at: string;
}

interface ReleaseApprovalItem {
  id: string;
  instrument_id: string;
  institution_name?: string;
  request_type: string;
  reason: string;
  officer_recommendation: string;
  officer_notes?: string;
  recommended_by?: string;
  created_at: string;
  amount?: string;
}

export const ApprovalsInbox: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState<'instruments' | 'releases' | 'active_portfolio'>('instruments');

  // Instruments awaiting approval pagination
  const [instPage, setInstPage] = useState(1);
  const [instPageSize, setInstPageSize] = useState(10);

  // Release requests pagination
  const [relPage, setRelPage] = useState(1);
  const [relPageSize, setRelPageSize] = useState(10);

  // Active Portfolio / Maturity Tracker state
  const [activePage, setActivePage] = useState(1);
  const [activePageSize, setActivePageSize] = useState(10);
  const [activeSearch, setActiveSearch] = useState('');
  const [activeMaturityFilter, setActiveMaturityFilter] = useState<'ALL' | 'CRITICAL' | 'EXPIRING' | 'MATURED'>('ALL');

  // Approval Modal State
  const [selectedInstrument, setSelectedInstrument] = useState<VerifiedInstrumentItem | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [isActivating, setIsActivating] = useState(false);

  // 1. Fetch Verified Instruments awaiting Approver final activation
  const {
    data: instrumentsData,
    isLoading: isInstrumentsLoading,
    error: instrumentsError,
  } = useQuery({
    queryKey: queryKeys.instruments.list({ status: 'VERIFIED', page: instPage, pageSize: instPageSize }),
    queryFn: async () => {
      const res = await apiClient.get('/instruments', {
        params: { status: 'VERIFIED', page: instPage, page_size: instPageSize },
      });
      return res.data;
    },
  });

  // 2. Fetch Release Requests awaiting Approver adjudication
  const {
    data: releasesData,
    isLoading: isReleasesLoading,
    error: releasesError,
  } = useQuery({
    queryKey: queryKeys.releases.list({ status: 'UNDER_REVIEW', page: relPage, pageSize: relPageSize }),
    queryFn: async () => {
      const res = await apiClient.get('/release-requests', {
        params: { status: 'UNDER_REVIEW', page: relPage, page_size: relPageSize },
      });
      return res.data;
    },
  });

  // 3. Fetch Active / Portfolio Instruments for Maturity Tracker
  const {
    data: activeInstrumentsData,
    isLoading: isActiveLoading,
    error: activeError,
  } = useQuery({
    queryKey: queryKeys.instruments.list({
      status: activeMaturityFilter === 'MATURED' ? 'MATURED' : activeMaturityFilter === 'EXPIRING' ? 'EXPIRING' : 'ACTIVE',
      page: activePage,
      pageSize: activePageSize,
      search: activeSearch,
    }),
    queryFn: async () => {
      const params: Record<string, any> = {
        page: activePage,
        page_size: activePageSize,
      };
      if (activeSearch) params.search = activeSearch;
      if (activeMaturityFilter === 'MATURED') {
        params.status = 'MATURED';
      } else if (activeMaturityFilter === 'EXPIRING') {
        params.status = 'EXPIRING';
      } else if (activeMaturityFilter === 'ALL') {
        params.status = 'ACTIVE';
      }
      const res = await apiClient.get('/instruments', { params });
      return res.data;
    },
  });

  const verifiedItems: VerifiedInstrumentItem[] = instrumentsData?.items || [];
  const verifiedTotal: number = instrumentsData?.total || 0;

  const releaseItems: ReleaseApprovalItem[] = releasesData?.items || [];
  const releaseTotal: number = releasesData?.total || 0;

  const activeItems: VerifiedInstrumentItem[] = activeInstrumentsData?.items || [];
  const activeTotal: number = activeInstrumentsData?.total || 0;

  // Calculate quick maturity stats from active items
  const criticalCount = activeItems.filter((i) => {
    const days = getDaysRemaining(i.maturity_date);
    return days !== null && days <= 30 && days >= 0;
  }).length;

  const expiringCount = activeItems.filter((i) => {
    const days = getDaysRemaining(i.maturity_date);
    return days !== null && days <= 90 && days > 30;
  }).length;

  // Handle statutory activation
  const handleConfirmActivate = async () => {
    if (!selectedInstrument) return;
    setIsActivating(true);
    try {
      await apiClient.post(`/instruments/${selectedInstrument.id}/activate`, {
        notes: approvalNotes || 'Statutory approval granted by Approving Authority.',
      });
      success(
        'Deposit Approved & Activated',
        `Instrument #${selectedInstrument.reference_number} is now ACTIVE. Switched to Maturity Tracker to monitor expiry countdown.`
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.instruments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.officer.queue() });
      setSelectedInstrument(null);
      setApprovalNotes('');
      // Automatically switch to Active Deposits & Maturity Tracker tab
      setActiveTab('active_portfolio');
    } catch (err: any) {
      toastError('Activation Failed', formatApiError(err, 'Failed to activate the instrument.'));
    } finally {
      setIsActivating(false);
    }
  };

  // Columns for Verified Instruments
  const instrumentColumns: Column<VerifiedInstrumentItem>[] = [
    {
      key: 'reference_number',
      header: 'Instrument / FDR Ref',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span className="font-mono font-bold text-slate-900 tracking-tight">
            {row.reference_number}
          </span>
          <InstrumentTypeBadge type={row.instrument_type} size="sm" />
        </div>
      ),
    },
    {
      key: 'issuing_bank',
      header: 'Bank & Branch',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800 text-sm">{row.issuing_bank}</span>
          <span className="text-xs text-slate-500">{row.branch || 'Main Branch'}</span>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Deposit Amount',
      render: (row) => (
        <span className="font-bold text-slate-900 text-sm font-mono">
          {formatINR(row.amount)}
        </span>
      ),
    },
    {
      key: 'maturity_date',
      header: 'Maturity Date',
      render: (row) => (
        <span className="text-xs font-medium text-slate-700">
          {formatDateIST(row.maturity_date)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Officer Scrutiny',
      render: () => (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
          VERIFIED BY OFFICER
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Submitted',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {formatDateIST(row.created_at, true)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Statutory Adjudication',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="black"
            size="sm"
            onClick={() => {
              setSelectedInstrument(row);
              setApprovalNotes('');
            }}
            leftIcon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          >
            Approve & Activate
          </Button>
          <Button
            variant="black"
            size="sm"
            onClick={() => navigate(`/officer/scrutiny/${row.id}`)}
            leftIcon={<Eye className="w-4 h-4 text-slate-400" />}
          >
            Scrutiny
          </Button>
        </div>
      ),
    },
  ];

  // Columns for Release Requests
  const releaseColumns: Column<ReleaseApprovalItem>[] = [
    {
      key: 'id',
      header: 'Request Ref',
      render: (row) => (
        <span className="font-mono font-semibold text-slate-900">
          #{row.id.slice(0, 8)}
        </span>
      ),
    },
    {
      key: 'request_type',
      header: 'Type',
      render: (row) => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
          {row.request_type}
        </span>
      ),
    },
    {
      key: 'officer_recommendation',
      header: 'Officer Finding',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
            row.officer_recommendation === 'RECOMMEND'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {row.officer_recommendation === 'RECOMMEND' ? 'RECOMMENDED' : 'NOT RECOMMENDED'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Submitted',
      render: (row) => formatDateIST(row.created_at, true),
    },
    {
      key: 'reason',
      header: 'Grounds for Release',
      render: (row) => (
        <span className="text-xs text-slate-600 line-clamp-1 max-w-xs">{row.reason}</span>
      ),
    },
    {
      key: 'action',
      header: 'Adjudication',
      align: 'right',
      render: (row) => (
        <Button
          variant="black"
          size="sm"
          onClick={() => navigate(`/release-requests/${row.id}`)}
          leftIcon={<CheckSquare className="w-4 h-4" />}
        >
          Adjudicate
        </Button>
      ),
    },
  ];

  // Columns for Active Portfolio & Maturity Tracker
  const activeColumns: Column<VerifiedInstrumentItem>[] = [
    {
      key: 'reference_number',
      header: 'Instrument Reference',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span className="font-mono font-bold text-slate-900">
            {row.reference_number}
          </span>
          <InstrumentTypeBadge type={row.instrument_type} size="sm" />
        </div>
      ),
    },
    {
      key: 'issuing_bank',
      header: 'Bank & Branch',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800 text-sm">{row.issuing_bank}</span>
          <span className="text-xs text-slate-500">{row.branch || 'Main Branch'}</span>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Principal Deposit',
      render: (row) => (
        <span className="font-bold text-slate-900 text-sm font-mono">
          {formatINR(row.amount)}
        </span>
      ),
    },
    {
      key: 'maturity_date',
      header: 'Maturity & Real-Time Countdown',
      render: (row) => {
        const days = getDaysRemaining(row.maturity_date);
        return (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-800">
              {formatDateIST(row.maturity_date)}
            </span>
            {days !== null && (
              <div>
                {days > 90 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <Clock className="w-3 h-3 text-emerald-600" />
                    {days} days remaining
                  </span>
                ) : days > 30 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    <Clock className="w-3 h-3 text-amber-600" />
                    {days} days (90d Notice)
                  </span>
                ) : days > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-900 border border-orange-300">
                    <AlertTriangle className="w-3 h-3 text-orange-600" />
                    {days} days (Critical)
                  </span>
                ) : days === 0 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-900 border border-red-300">
                    <AlertTriangle className="w-3 h-3 text-red-600" />
                    Matures Today
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-800 border border-red-200">
                    <AlertCircle className="w-3 h-3 text-red-600" />
                    {Math.abs(days)}d Overdue
                  </span>
                )}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'AICTE Registry Status',
      render: (row) => (
        <div className="flex flex-col gap-1.5 items-start">
          <StatusBadge status={row.status} size="sm" />
          <VerificationTag
            isBankVerified={Boolean(row.verification_tag === 'BANK_VERIFIED' || row.status === 'ACTIVE')}
          />
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Lifecycle Tracking',
      align: 'right',
      render: (row) => (
        <Button
          variant="black"
          size="sm"
          onClick={() => navigate(`/instruments/${row.id}`)}
          leftIcon={<Eye className="w-4 h-4" />}
        >
          Track & Details
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals & Deposit Maturity Command Console"
        subtitle="Statutory approval workflow and real-time maturity countdown tracker for AICTE security deposits"
        breadcrumbs={[
          { label: 'Home', path: '/' },
          { label: 'Approvals & Maturity Tracker' },
        ]}
      />

      {/* Segregation of Duties Notice */}
      <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>
            <strong className="text-white">AICTE Statutory Governance:</strong> Dual control enforced. Approvers execute final deposit activation and monitor statutory maturity windows and bank guarantees.
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('instruments')}
          className={`pb-3 px-1 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'instruments'
              ? 'border-black text-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Verified Deposit Instruments (FDR / BG)</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === 'instruments'
                ? 'bg-black text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {verifiedTotal}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('active_portfolio')}
          className={`pb-3 px-1 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'active_portfolio'
              ? 'border-black text-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Active Deposits & Maturity Tracker</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === 'active_portfolio'
                ? 'bg-black text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {activeTotal}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('releases')}
          className={`pb-3 px-1 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'releases'
              ? 'border-black text-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Deposit Release & Refund Requests</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === 'releases'
                ? 'bg-black text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {releaseTotal}
          </span>
        </button>
      </div>

      {/* Tab 1: Verified Deposit Instruments */}
      {activeTab === 'instruments' && (
        <DataTable
          columns={instrumentColumns}
          data={verifiedItems}
          isLoading={isInstrumentsLoading}
          error={instrumentsError ? 'Failed to fetch verified instruments for approval.' : null}
          page={instPage}
          pageSize={instPageSize}
          totalRecords={verifiedTotal}
          onPageChange={setInstPage}
          onRowClick={(row) => navigate(`/officer/scrutiny/${row.id}`)}
          emptyMessage="No verified deposit instruments currently awaiting approval. Instruments verified by officers will appear here for statutory activation."
        />
      )}

      {/* Tab 2: Active Deposits & Maturity Tracker */}
      {activeTab === 'active_portfolio' && (
        <div className="space-y-4">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Active FDR Portfolio</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-slate-900">{activeTotal}</span>
                <span className="text-xs text-slate-500">Deposits in Registry</span>
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs">
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider block">Expiring within 90d</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-amber-700">{expiringCount}</span>
                <span className="text-xs text-slate-500">Renewal Notice Window</span>
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs">
              <span className="text-xs font-semibold text-orange-700 uppercase tracking-wider block">Critical &lt; 30 Days</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-orange-700">{criticalCount}</span>
                <span className="text-xs text-slate-500">Action Required</span>
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider block">Lien Status</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-emerald-700">100%</span>
                <span className="text-xs text-slate-500">AICTE Joint Lien</span>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-lg">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={activeSearch}
                onChange={(e) => {
                  setActiveSearch(e.target.value);
                  setActivePage(1);
                }}
                placeholder="Search reference number or bank..."
                className="w-full text-xs bg-transparent border-0 focus:outline-none text-slate-800 placeholder-slate-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveMaturityFilter('ALL');
                  setActivePage(1);
                }}
                className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                  activeMaturityFilter === 'ALL'
                    ? 'bg-black text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Active
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveMaturityFilter('EXPIRING');
                  setActivePage(1);
                }}
                className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                  activeMaturityFilter === 'EXPIRING'
                    ? 'bg-black text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Expiring Soon
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveMaturityFilter('MATURED');
                  setActivePage(1);
                }}
                className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                  activeMaturityFilter === 'MATURED'
                    ? 'bg-black text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Matured / Overdue
              </button>
            </div>
          </div>

          <DataTable
            columns={activeColumns}
            data={activeItems}
            isLoading={isActiveLoading}
            error={activeError ? 'Failed to fetch active deposits for maturity tracker.' : null}
            page={activePage}
            pageSize={activePageSize}
            totalRecords={activeTotal}
            onPageChange={setActivePage}
            onRowClick={(row) => navigate(`/instruments/${row.id}`)}
            emptyMessage="No active deposit instruments match the selected maturity filter."
          />
        </div>
      )}

      {/* Tab 3: Release Requests */}
      {activeTab === 'releases' && (
        <DataTable
          columns={releaseColumns}
          data={releaseItems}
          isLoading={isReleasesLoading}
          error={releasesError ? 'Failed to fetch pending approval inbox.' : null}
          page={relPage}
          pageSize={relPageSize}
          totalRecords={releaseTotal}
          onPageChange={setRelPage}
          onRowClick={(row) => navigate(`/release-requests/${row.id}`)}
          emptyMessage="No release requests pending final authorization."
        />
      )}

      {/* Approver Statutory Approval Modal */}
      {selectedInstrument && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden transform transition-all">
            <div className="p-5 flex items-start gap-4">
              <div className="p-3 rounded-full shrink-0 bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">
                  Grant Statutory Approval & Activate Deposit
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  You are granting final approval as the Approving Authority under AICTE statutory dual control.
                </p>

                {/* Instrument Summary Card */}
                <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <span className="text-slate-500 font-medium">Instrument Reference:</span>
                    <span className="font-mono font-bold text-slate-900">{selectedInstrument.reference_number}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Bank & Branch:</span>
                    <span className="font-semibold text-slate-800">{selectedInstrument.issuing_bank} ({selectedInstrument.branch || 'Main Branch'})</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Deposit Principal:</span>
                    <span className="font-bold text-emerald-700 font-mono text-sm">{formatINR(selectedInstrument.amount)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Maturity Date:</span>
                    <span className="font-medium text-slate-800">{formatDateIST(selectedInstrument.maturity_date)}</span>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Approver Decision Remarks / Reference Circular (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    placeholder="Enter approval circular number, sanction order reference, or audit remarks..."
                    className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInstrument(null)}
                disabled={isActivating}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 px-5 py-3.5 flex justify-end gap-3 border-t border-slate-200">
              <Button
                variant="black"
                size="sm"
                onClick={() => setSelectedInstrument(null)}
                disabled={isActivating}
              >
                Cancel
              </Button>
              <Button
                variant="black"
                size="sm"
                isLoading={isActivating}
                onClick={handleConfirmActivate}
                leftIcon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              >
                Approve & Activate Deposit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
