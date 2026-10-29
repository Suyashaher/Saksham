import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Clock, Eye, ShieldCheck, AlertTriangle } from 'lucide-react';
import { apiClient } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { formatINR, formatDateIST } from '../../utils/formatters';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { DataTable, Column } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { InstrumentTypeBadge } from '../../components/ui/InstrumentTypeBadge';
import { TrustScoreBadge } from '../../components/ui/ai/TrustScoreBadge';
import { PredictionChip } from '../../components/ui/ai/PredictionChip';
import { useAiConfig } from '../../components/ui/ai/AiProvider';
import { aiApi } from '../../api/ai';

interface QueueItem {
  id: string;
  fdr_number: string;
  reference_number?: string;
  instrument_type?: string;
  institution_name?: string;
  bank_name: string;
  branch_name: string;
  amount: string;
  status: string;
  created_at: string;
  ageing_days?: number;
}

const QueueTrustCell: React.FC<{ instrumentId: string }> = ({ instrumentId }) => {
  const { data } = useQuery({
    queryKey: queryKeys.ai.trustScore(instrumentId),
    queryFn: () => aiApi.getTrustScore(instrumentId),
    staleTime: 60 * 1000,
  });

  if (!data) return <span className="text-slate-400 text-xs">—</span>;

  return (
    <TrustScoreBadge
      score={data.score}
      band={data.band}
      reasons={data.factors}
      weightsVersion={data.weights_version}
      dataSource={data.data_source}
    />
  );
};

const QueuePredictionCell: React.FC<{ instrumentId: string }> = ({ instrumentId }) => {
  const { data } = useQuery({
    queryKey: queryKeys.ai.predictedTime(instrumentId),
    queryFn: () => aiApi.getPredictedTime(instrumentId),
    staleTime: 60 * 1000,
  });

  if (!data?.verification) return <span className="text-slate-400 text-xs">—</span>;

  return (
    <PredictionChip
      predictedDays={data.verification.predicted_days}
      intervalLow={data.verification.interval_low}
      intervalHigh={data.verification.interval_high}
      isHeuristic={data.verification.is_heuristic}
      modelVersion={data.verification.model_version}
      dataSource={data.verification.data_source}
      reasons={data.verification.reasons}
    />
  );
};

export const OfficerQueue: React.FC = () => {
  const navigate = useNavigate();
  const { isFeatureEnabled } = useAiConfig();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.officer.queue({ page, pageSize }),
    queryFn: async () => {
      // Query instruments in SUBMITTED or UNDER_SCRUTINY
      const res = await apiClient.get('/instruments', {
        params: {
          page,
          page_size: pageSize,
          status: 'SUBMITTED', // Or combine with UNDER_SCRUTINY
        },
      });
      return res.data;
    },
  });

  const queueItems: QueueItem[] = data?.items || [];
  const total = data?.total || 0;

  const calculateAgeing = (createdDateStr: string) => {
    try {
      const created = new Date(createdDateStr);
      const now = new Date();
      const diffMs = now.getTime() - created.getTime();
      return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    } catch {
      return 0;
    }
  };

  const columns: Column<QueueItem>[] = [
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
    ...(isFeatureEnabled('trust_score')
      ? [
          {
            key: 'trust_score' as const,
            header: 'AI Trust Score',
            render: (row: QueueItem) => <QueueTrustCell instrumentId={row.id} />,
          },
        ]
      : []),
    ...(isFeatureEnabled('prediction')
      ? [
          {
            key: 'prediction' as const,
            header: 'Est. Resolution',
            render: (row: QueueItem) => <QueuePredictionCell instrumentId={row.id} />,
          },
        ]
      : []),
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
      header: 'Deposit Amount',
      render: (row) => (
        <span className="font-bold text-slate-900">{formatINR(row.amount)}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Submitted On',
      render: (row) => formatDateIST(row.created_at, true),
    },
    {
      key: 'ageing',
      header: 'Ageing in Queue',
      render: (row) => {
        const days = row.ageing_days ?? calculateAgeing(row.created_at);
        return (
          <span
            className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
              days >= 5
                ? 'bg-red-100 text-red-800 border border-red-200'
                : days >= 3
                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            {days} {days === 1 ? 'day' : 'days'}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      key: 'action',
      header: 'Scrutiny',
      align: 'right',
      render: (row) => (
        <Button
          variant="black"
          size="sm"
          onClick={() => navigate(`/officer/scrutiny/${row.id}`)}
          leftIcon={<ShieldCheck className="w-4 h-4" />}
        >
          Scrutinize
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verification Scrutiny Work Queue"
        subtitle="Unassigned & pending security deposit submissions awaiting officer validation"
        breadcrumbs={[
          { label: 'Home', path: '/' },
          { label: 'Officer Console' },
          { label: 'Scrutiny Queue' },
        ]}
      />

      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <span>
          AICTE SLA standard: Submissions in queue exceeding 5 days trigger automated alert escalation to regional director.
        </span>
      </div>

      <DataTable
        columns={columns}
        data={queueItems}
        isLoading={isLoading}
        error={error ? 'Failed to fetch scrutiny queue.' : null}
        page={page}
        pageSize={pageSize}
        totalRecords={total}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/officer/scrutiny/${row.id}`)}
        emptyMessage="No pending FDR submissions in your scrutiny queue. All records are up to date."
      />
    </div>
  );
};
