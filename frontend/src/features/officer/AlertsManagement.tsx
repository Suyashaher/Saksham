import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle2, AlertTriangle, Check, X, ShieldAlert, Mail, Smartphone, MessageSquare } from 'lucide-react';
import { apiClient } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { formatDateIST } from '../../utils/formatters';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { FilterBar } from '../../components/ui/FilterBar';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';

interface AlertItem {
  id: string;
  rule_name: string;
  instrument_id: string;
  channel: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  escalation_level: number;
  failure_count: number;
  last_error?: string | null;
  scheduled_at: string;
  resolved: boolean;
  resolved_at?: string | null;
  resolved_reason?: string | null;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
}

export const AlertsManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState('');
  const [resolvedFilter, setResolvedFilter] = useState('');
  const [selectedAlertForResolve, setSelectedAlertForResolve] = useState<AlertItem | null>(null);
  const [resolveReason, setResolveReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.alerts.list({ page, pageSize, status: statusFilter, resolved: resolvedFilter }),
    queryFn: async () => {
      const params: Record<string, any> = { page, page_size: pageSize };
      if (statusFilter) params.status = statusFilter;
      if (resolvedFilter) params.resolved = resolvedFilter === 'true';

      const res = await apiClient.get('/alerts', { params });
      return res.data;
    },
  });

  const alerts: AlertItem[] = data?.items || [];
  const total = data?.total || 0;

  // Acknowledge alert
  const handleAcknowledge = async (alertId: string) => {
    setIsProcessing(true);
    try {
      await apiClient.post(`/alerts/${alertId}/acknowledge`);
      success('Alert Acknowledged', 'Recorded officer acknowledgement in the audit log.');
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all });
    } catch (err: any) {
      toastError('Action Failed', err.response?.data?.detail || 'Could not acknowledge alert.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Resolve alert
  const handleResolve = async () => {
    if (!selectedAlertForResolve || !resolveReason) {
      toastError('Reason Required', 'Please enter a resolution justification.');
      return;
    }

    setIsProcessing(true);
    try {
      await apiClient.post(`/alerts/${selectedAlertForResolve.id}/resolve`, {
        reason: resolveReason,
      });
      success('Alert Resolved', 'Alert closed and escalated chain terminated.');
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all });
      setSelectedAlertForResolve(null);
      setResolveReason('');
    } catch (err: any) {
      toastError('Action Failed', err.response?.data?.detail || 'Could not resolve alert.');
    } finally {
      setIsProcessing(false);
    }
  };

  const columns: Column<AlertItem>[] = [
    {
      key: 'rule_name',
      header: 'Alert Rule',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-900">{row.rule_name}</p>
          <p className="text-xs font-mono text-slate-500">ID: {row.instrument_id?.slice(0, 8)}...</p>
        </div>
      ),
    },
    {
      key: 'channel',
      header: 'Channel',
      render: (row) => {
        const icon =
          row.channel === 'EMAIL' ? (
            <Mail className="w-3.5 h-3.5" />
          ) : row.channel === 'SMS' ? (
            <Smartphone className="w-3.5 h-3.5" />
          ) : (
            <MessageSquare className="w-3.5 h-3.5" />
          );
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
            {icon} {row.channel}
          </span>
        );
      },
    },
    {
      key: 'escalation_level',
      header: 'Level / Errors',
      render: (row) => (
        <div>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded ${
              row.escalation_level > 1
                ? 'bg-red-100 text-red-800'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            Level {row.escalation_level}
          </span>
          {row.failure_count > 0 && (
            <span className="block text-[10px] text-red-600 font-medium mt-0.5">
              {row.failure_count} retries failed
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Delivery Status',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
            row.status === 'SENT'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : row.status === 'FAILED'
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-amber-50 text-amber-800 border border-amber-200'
          }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      key: 'scheduled_at',
      header: 'Scheduled Date',
      render: (row) => formatDateIST(row.scheduled_at, true),
    },
    {
      key: 'resolution',
      header: 'State',
      render: (row) => (
        <div>
          {row.resolved ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
            </span>
          ) : row.acknowledged_at ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
              <Check className="w-3.5 h-3.5" /> Acknowledged
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
              <AlertTriangle className="w-3.5 h-3.5" /> Action Required
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          {!row.acknowledged_at && !row.resolved && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAcknowledge(row.id)}
              disabled={isProcessing}
              className="text-xs"
            >
              Acknowledge
            </Button>
          )}
          {!row.resolved && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setSelectedAlertForResolve(row)}
              disabled={isProcessing}
              className="text-xs"
            >
              Resolve
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts, Notifications & Escalations"
        subtitle="Automated alerts for validity tracking, overdue instruments, and stale verification workflows"
        breadcrumbs={[
          { label: 'Home', path: '/' },
          { label: 'Alerts & Escalations' },
        ]}
      />

      <FilterBar
        filters={[
          {
            key: 'status',
            label: 'Delivery Status',
            type: 'select',
            options: [
              { label: 'Sent', value: 'SENT' },
              { label: 'Pending', value: 'PENDING' },
              { label: 'Failed', value: 'FAILED' },
            ],
          },
          {
            key: 'resolved',
            label: 'Resolution',
            type: 'select',
            options: [
              { label: 'Unresolved Only', value: 'false' },
              { label: 'Resolved Only', value: 'true' },
            ],
          },
        ]}
        filterValues={{ status: statusFilter, resolved: resolvedFilter }}
        onFilterChange={(key, val) => {
          if (key === 'status') setStatusFilter(val);
          if (key === 'resolved') setResolvedFilter(val);
          setPage(1);
        }}
        onReset={() => {
          setStatusFilter('');
          setResolvedFilter('');
          setPage(1);
        }}
      />

      <DataTable
        columns={columns}
        data={alerts}
        isLoading={isLoading}
        error={error ? 'Failed to fetch alerts.' : null}
        page={page}
        pageSize={pageSize}
        totalRecords={total}
        onPageChange={setPage}
      />

      {/* Resolve Dialog */}
      <ConfirmDialog
        isOpen={Boolean(selectedAlertForResolve)}
        title={`Resolve Alert: ${selectedAlertForResolve?.rule_name}`}
        message={
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              Provide the audit resolution reason. Resolving this alert halts further automated escalation notifications.
            </p>
            <textarea
              rows={3}
              value={resolveReason}
              onChange={(e) => setResolveReason(e.target.value)}
              placeholder="e.g. Bank confirmation letter received and verified via RTGS ref..."
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        }
        confirmLabel="Resolve & Close Alert"
        variant="info"
        isLoading={isProcessing}
        onConfirm={handleResolve}
        onCancel={() => {
          setSelectedAlertForResolve(null);
          setResolveReason('');
        }}
      />
    </div>
  );
};
