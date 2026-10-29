import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, RefreshCw, Send, AlertCircle, FileText } from 'lucide-react';
import { apiClient } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { formatINR, formatDateIST, getDaysRemaining } from '../../utils/formatters';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { VerificationTag } from '../../components/ui/VerificationTag';
import { InstrumentTypeBadge } from '../../components/ui/InstrumentTypeBadge';
import { DataTable, Column } from '../../components/ui/DataTable';
import { FilterBar } from '../../components/ui/FilterBar';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';

export interface InstrumentSummary {
  id: string;
  fdr_number: string;
  reference_number?: string;
  instrument_type?: string;
  bank_name: string;
  branch_name: string;
  amount: string;
  currency: string;
  issue_date: string;
  maturity_date: string;
  claim_expiry_date?: string | null;
  status: string;
  is_verified?: boolean;
  bank_verified_at?: string;
  parent_instrument_id?: string | null;
  renewal_count?: number;
}

export const InstrumentList: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('maturity_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.instruments.list({ page, pageSize, search, status: statusFilter, instrument_type: typeFilter, sortBy, sortOrder }),
    queryFn: async () => {
      const params: Record<string, any> = {
        page,
        page_size: pageSize,
      };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.instrument_type = typeFilter;

      const res = await apiClient.get('/instruments', { params });
      return res.data;
    },
  });

  const instruments: InstrumentSummary[] = data?.items || [];
  const total = data?.total || 0;

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
  };

  const columns: Column<InstrumentSummary>[] = [
    {
      key: 'fdr_number',
      header: 'Reference Number',
      sortable: true,
      render: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono font-medium text-slate-900">
              {row.reference_number || row.fdr_number}
            </span>
            <InstrumentTypeBadge type={row.instrument_type} size="sm" />
          </div>
          {row.parent_instrument_id && (
            <span className="block text-[10px] text-purple-700 font-sans">
              ↳ Renewed Instrument
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'bank_name',
      header: 'Bank & Branch',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-800">{row.bank_name}</div>
          <div className="text-xs text-slate-500">{row.branch_name}</div>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Principal Amount',
      sortable: true,
      render: (row) => (
        <span className="font-semibold text-slate-900">{formatINR(row.amount)}</span>
      ),
    },
    {
      key: 'maturity_date',
      header: 'Maturity / Days Left',
      sortable: true,
      render: (row) => {
        const daysLeft = getDaysRemaining(row.maturity_date);
        return (
          <div>
            <div className="text-xs font-medium text-slate-800">
              {formatDateIST(row.maturity_date)}
            </div>
            {daysLeft !== null && (
              <span
                className={`inline-block text-[11px] font-medium px-1.5 py-0.5 rounded mt-0.5 ${
                  daysLeft < 0
                    ? 'bg-red-100 text-red-800 font-semibold'
                    : daysLeft <= 30
                    ? 'bg-amber-100 text-amber-800'
                    : daysLeft <= 90
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-500'
                }`}
              >
                {daysLeft < 0
                  ? `Overdue by ${Math.abs(daysLeft)}d`
                  : daysLeft === 0
                  ? 'Matures Today'
                  : `${daysLeft} days remaining`}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Lifecycle Status',
      render: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      key: 'verification',
      header: 'Verification Source',
      render: (row) => (
        <VerificationTag
          isBankVerified={Boolean(row.is_verified || row.status === 'VERIFIED' || row.status === 'ACTIVE')}
          verifiedAt={row.bank_verified_at ? formatDateIST(row.bank_verified_at) : undefined}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/instruments/${row.id}`)}
            leftIcon={<Eye className="w-3.5 h-3.5" />}
          >
            View
          </Button>

          {['ACTIVE', 'EXPIRING', 'MATURED'].includes(row.status) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/instruments/${row.id}?tab=renew`)}
              title="Renew FDR"
              className="text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          )}

          {['ACTIVE', 'EXPIRING', 'MATURED'].includes(row.status) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/instruments/${row.id}?tab=release`)}
              title="Request Release / Refund"
              className="text-xs text-indigo-700 hover:text-indigo-900 border-indigo-200"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Institutional FDR Portfolio"
        subtitle="Active fixed deposits, security deposits, and bank guarantees submitted to AICTE"
        breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'My FDRs' }]}
        actions={
          <Button
            variant="primary"
            onClick={() => navigate('/instruments/new')}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Submit New FDR
          </Button>
        }
      />

      <div className="mb-4">
        <FilterBar
          searchValue={search}
          onSearchChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          searchPlaceholder="Search by FDR number, bank name, branch..."
          filters={[
            {
              key: 'instrument_type',
              label: 'Type',
              type: 'select',
              options: [
                { label: 'All Types', value: '' },
                { label: 'Fixed Deposit (FDR)', value: 'FDR' },
                { label: 'Bank Guarantee (BG)', value: 'BANK_GUARANTEE' },
              ],
            },
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              options: [
                { label: 'Submitted', value: 'SUBMITTED' },
                { label: 'Under Scrutiny', value: 'UNDER_SCRUTINY' },
                { label: 'Bank Verified', value: 'VERIFIED' },
                { label: 'Active', value: 'ACTIVE' },
                { label: 'Expiring Soon', value: 'EXPIRING' },
                { label: 'Matured / Overdue', value: 'MATURED' },
                { label: 'Renewed', value: 'RENEWED' },
                { label: 'Release Requested', value: 'RELEASE_REQUESTED' },
                { label: 'Released & Closed', value: 'RELEASED' },
              ],
            },
          ]}
          filterValues={{ status: statusFilter, instrument_type: typeFilter }}
          onFilterChange={(key, val) => {
            if (key === 'instrument_type') setTypeFilter(val);
            if (key === 'status') setStatusFilter(val);
            setPage(1);
          }}
          onReset={() => {
            setSearch('');
            setStatusFilter('');
            setTypeFilter('');
            setPage(1);
          }}
        />
      </div>

      <DataTable
        columns={columns}
        data={instruments}
        isLoading={isLoading}
        error={error ? 'Failed to fetch instruments. Please try again.' : null}
        page={page}
        pageSize={pageSize}
        totalRecords={total}
        onPageChange={(newPage) => setPage(newPage)}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onRowClick={(row) => navigate(`/instruments/${row.id}`)}
      />
    </div>
  );
};
