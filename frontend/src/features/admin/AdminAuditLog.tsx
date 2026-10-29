import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, ShieldCheck, AlertOctagon, CheckCircle2, Lock, Filter } from 'lucide-react';
import { apiClient } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { formatDateIST } from '../../utils/formatters';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  actor_id?: string;
  actor_name?: string;
  actor_role?: string;
  created_at: string;
  current_hash: string;
  prev_hash: string;
  payload?: any;
}

export const AdminAuditLog: React.FC = () => {
  const { success, error: toastError } = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [actionFilter, setActionFilter] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    total_checked: number;
    head_hash?: string;
  } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.admin.auditLogs({ page, pageSize, action: actionFilter }),
    queryFn: async () => {
      const params: Record<string, any> = { page, page_size: pageSize };
      if (actionFilter) params.action = actionFilter;

      const res = await apiClient.get('/audit-logs', { params });
      return res.data;
    },
  });

  const logs: AuditEntry[] = data?.items || [];
  const total = data?.total || 0;

  const handleVerifyChain = async () => {
    setIsVerifying(true);
    try {
      const res = await apiClient.get('/audit-logs/verify');
      setVerificationResult(res.data);
      if (res.data.valid) {
        success('Audit Chain Verified', `Cryptographic integrity confirmed across ${res.data.total_checked} blocks.`);
      } else {
        toastError('Integrity Compromise', 'Chain hash mismatch detected in audit log history!');
      }
    } catch (err: any) {
      toastError('Verification Error', err.response?.data?.detail || 'Unable to execute chain verification.');
    } finally {
      setIsVerifying(false);
    }
  };

  const columns: Column<AuditEntry>[] = [
    {
      key: 'action',
      header: 'Audit Action',
      render: (row) => (
        <div>
          <span className="font-mono font-bold text-xs text-primary">{row.action}</span>
          <p className="text-[11px] text-slate-500">
            {row.entity_type}: {row.entity_id?.slice(0, 8)}...
          </p>
        </div>
      ),
    },
    {
      key: 'actor',
      header: 'Actor & Identity',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-800 text-xs">
            {row.actor_name || (row.actor_id ? 'Authenticated User' : 'SYSTEM')}
          </p>
          <span className="text-[10px] text-slate-500 font-mono">
            {row.actor_role || 'AUTOMATED_SCAN'}
          </span>
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Timestamp (IST)',
      render: (row) => formatDateIST(row.created_at, true),
    },
    {
      key: 'hash',
      header: 'SHA-256 Block Hash',
      render: (row) => (
        <div className="font-mono text-[10px] space-y-0.5 max-w-[200px]">
          <div className="text-slate-800 truncate" title={`Current: ${row.current_hash}`}>
            H: {row.current_hash?.slice(0, 16)}...
          </div>
          <div className="text-slate-400 truncate" title={`Previous: ${row.prev_hash}`}>
            P: {row.prev_hash?.slice(0, 16)}...
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Immutable Hash-Chained Audit Trail"
        subtitle="Cryptographically sealed ledger verifying state machine transitions, logins, and approvals"
        breadcrumbs={[
          { label: 'Home', path: '/' },
          { label: 'Administration' },
          { label: 'Audit Trail' },
        ]}
        actions={
          <Button
            variant="black"
            size="md"
            onClick={handleVerifyChain}
            isLoading={isVerifying}
            leftIcon={<ShieldCheck className="w-4 h-4" />}
          >
            Verify Chain Integrity
          </Button>
        }
      />

      {/* Verification Seal Banner */}
      {verificationResult && (
        <div
          className={`p-4 rounded-lg border flex items-center justify-between text-xs ${
            verificationResult.valid
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-3">
            {verificationResult.valid ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            ) : (
              <AlertOctagon className="w-6 h-6 text-red-600 shrink-0" />
            )}
            <div>
              <p className="text-sm font-bold">
                {verificationResult.valid
                  ? 'Cryptographic Chain Integrity Confirmed'
                  : 'Hash Collision / Chain Tampering Alert!'}
              </p>
              <p className="mt-0.5">
                Total blocks verified: <strong>{verificationResult.total_checked}</strong> entries from genesis.
              </p>
            </div>
          </div>
          <span className="font-mono text-[11px] opacity-80">
            Seal: SHA-256 Validated
          </span>
        </div>
      )}

      <DataTable
        columns={columns}
        data={logs}
        isLoading={isLoading}
        error={error ? 'Failed to fetch audit log records.' : null}
        page={page}
        pageSize={pageSize}
        totalRecords={total}
        onPageChange={setPage}
      />
    </div>
  );
};
