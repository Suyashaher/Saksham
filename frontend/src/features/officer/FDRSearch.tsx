import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Download, Filter, RefreshCw, Eye, AlertCircle } from 'lucide-react';
import { apiClient } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { formatINR, formatDateIST, getDaysRemaining } from '../../utils/formatters';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { VerificationTag } from '../../components/ui/VerificationTag';
import { DataTable, Column } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { InstrumentTypeBadge } from '../../components/ui/InstrumentTypeBadge';
import { NlSearchBar } from '../ai/nlsearch/NlSearchBar';
import { FilterChipGroup } from '../ai/nlsearch/FilterChipGroup';
import { TrustScoreBadge } from '../../components/ui/ai/TrustScoreBadge';
import { NLSearchResponse } from '../../api/ai';

export const FDRSearch: React.FC = () => {
  const navigate = useNavigate();

  // Filters state mapping InstrumentFilter
  const [fdrNumber, setFdrNumber] = useState('');
  const [instrumentType, setInstrumentType] = useState('');
  const [bankName, setBankName] = useState('');
  const [status, setStatus] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [maturityFrom, setMaturityFrom] = useState('');
  const [maturityTo, setMaturityTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [nlResponse, setNlResponse] = useState<NLSearchResponse | null>(null);

  const handleNlResults = (res: NLSearchResponse | null) => {
    setNlResponse(res);
    if (res && res.parsed_filter) {
      // Map parsed filter fields into inputs if applicable
      const pf = res.parsed_filter as any;
      if (pf.instrument_types && pf.instrument_types.length > 0) setInstrumentType(pf.instrument_types[0]);
      if (pf.banks && pf.banks.length > 0) setBankName(pf.banks[0]);
      if (pf.statuses && pf.statuses.length > 0) setStatus(pf.statuses[0]);
      if (pf.amount_min) setMinAmount(String(pf.amount_min));
      if (pf.amount_max) setMaxAmount(String(pf.amount_max));
      if (pf.maturity_from) setMaturityFrom(String(pf.maturity_from));
      if (pf.maturity_to) setMaturityTo(String(pf.maturity_to));
    }
  };

  const handleRemoveChip = (chipIdx: number) => {
    if (!nlResponse) return;
    const updatedChips = nlResponse.chips.filter((_, idx) => idx !== chipIdx);
    setNlResponse({
      ...nlResponse,
      chips: updatedChips,
    });
    // Trigger structured re-run directly via query
    refetch();
  };

  const handleExport = () => {
    navigate('/reports');
  };

  const filtersPayload = {
    fdr_number: fdrNumber || undefined,
    instrument_types: instrumentType ? [instrumentType] : undefined,
    bank_name: bankName || undefined,
    status: status || undefined,
    min_amount: minAmount ? Number(minAmount) : undefined,
    max_amount: maxAmount ? Number(maxAmount) : undefined,
    maturity_date_from: maturityFrom || undefined,
    maturity_date_to: maturityTo || undefined,
    page,
    page_size: pageSize,
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.instruments.search(filtersPayload),
    queryFn: async () => {
      // POST /instruments/search with InstrumentFilter body
      const res = await apiClient.post('/instruments/search', filtersPayload);
      return res.data;
    },
  });

  const instruments = data?.items || [];
  const total = data?.total || 0;
  const isTruncated = data?.truncated || total > 500;

  const handleReset = () => {
    setFdrNumber('');
    setInstrumentType('');
    setBankName('');
    setStatus('');
    setMinAmount('');
    setMaxAmount('');
    setMaturityFrom('');
    setMaturityTo('');
    setPage(1);
  };

  const columns: Column<any>[] = [
    {
      key: 'fdr_number',
      header: 'Reference Number',
      render: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono font-semibold text-slate-900">
              {row.reference_number || row.fdr_number}
            </span>
            <InstrumentTypeBadge type={row.instrument_type} size="sm" />
          </div>
        </div>
      ),
    },
    {
      key: 'bank_name',
      header: 'Bank & Branch',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-800">{row.bank_name}</p>
          <p className="text-xs text-slate-500">{row.branch_name}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Principal Amount',
      render: (row) => <span className="font-bold text-slate-900">{formatINR(row.amount)}</span>,
    },
    {
      key: 'maturity_date',
      header: 'Maturity / Remaining',
      render: (row) => {
        const days = getDaysRemaining(row.maturity_date);
        return (
          <div>
            <span className="text-xs font-medium text-slate-800">{formatDateIST(row.maturity_date)}</span>
            {days !== null && (
              <span
                className={`block text-[11px] font-medium ${
                  days < 0 ? 'text-red-700 font-semibold' : days <= 30 ? 'text-amber-700' : 'text-slate-500'
                }`}
              >
                {days < 0 ? `Overdue by ${Math.abs(days)}d` : `${days} days left`}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      key: 'verification',
      header: 'Verification',
      render: (row) => (
        <VerificationTag
          isBankVerified={Boolean(row.is_verified || row.status === 'VERIFIED' || row.status === 'ACTIVE')}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/instruments/${row.id}`)}
          leftIcon={<Eye className="w-3.5 h-3.5" />}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institutional Instrument Directory & Search"
        subtitle="Shared multi-parameter query engine across all AICTE security deposits"
        breadcrumbs={[
          { label: 'Home', path: '/' },
          { label: 'Officer Console' },
          { label: 'Search Instruments' },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/reports')}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export Results
          </Button>
        }
      />

      {/* AI Search & Interpretation Chips (Phase 7C) */}
      <NlSearchBar onResults={handleNlResults} />

      {nlResponse && (
        <FilterChipGroup
          chips={nlResponse.chips}
          method={nlResponse.method}
          totalResults={nlResponse.total}
          durationMs={nlResponse.duration_ms}
          parsedFilter={nlResponse.parsed_filter}
          onRemoveChip={handleRemoveChip}
          onExport={handleExport}
        />
      )}

      {/* Structured Filter Card */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
          <Filter className="w-4 h-4 text-primary" />
          <span>Advanced Query Criteria</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Instrument Type</label>
            <select
              value={instrumentType}
              onChange={(e) => setInstrumentType(e.target.value)}
              className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Types</option>
              <option value="FDR">Fixed Deposit (FDR)</option>
              <option value="BANK_GUARANTEE">Bank Guarantee (BG)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reference Number</label>
            <input
              type="text"
              placeholder="e.g. BG-... or FDR-..."
              value={fdrNumber}
              onChange={(e) => setFdrNumber(e.target.value)}
              className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Bank Name</label>
            <input
              type="text"
              placeholder="e.g. State Bank of India"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Lifecycle Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_SCRUTINY">Under Scrutiny</option>
              <option value="VERIFIED">Verified</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRING">Expiring Soon</option>
              <option value="MATURED">Matured / Overdue</option>
              <option value="RENEWED">Renewed</option>
              <option value="RELEASE_REQUESTED">Release Requested</option>
              <option value="RELEASED">Released & Discharged</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Min Amount (₹)</label>
            <input
              type="number"
              placeholder="1000000"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Maturity From</label>
            <input
              type="date"
              value={maturityFrom}
              onChange={(e) => setMaturityFrom(e.target.value)}
              className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Maturity To</label>
            <input
              type="date"
              value={maturityTo}
              onChange={(e) => setMaturityTo(e.target.value)}
              className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="md:col-span-2 flex items-end justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Reset Filters
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setPage(1);
                refetch();
              }}
              leftIcon={<Search className="w-3.5 h-3.5" />}
            >
              Apply Filter Search
            </Button>
          </div>
        </div>
      </div>

      {isTruncated && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Query returned {total} matches. Results are paginated to protect memory. Export full dataset via Reports.
          </span>
        </div>
      )}

      <DataTable
        columns={columns}
        data={instruments}
        isLoading={isLoading}
        error={error ? 'Failed to execute query search.' : null}
        page={page}
        pageSize={pageSize}
        totalRecords={total}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/instruments/${row.id}`)}
      />
    </div>
  );
};
