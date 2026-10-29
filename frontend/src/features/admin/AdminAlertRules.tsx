import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sliders, Plus, CheckCircle2, XCircle, Mail, Smartphone, MessageSquare, AlertCircle } from 'lucide-react';
import { apiClient } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

interface AlertRule {
  id: string;
  name: string;
  rule_type: string;
  days: number;
  recipient_role: string;
  channels: string[];
  escalate_after_days?: number | null;
  is_active: boolean;
  created_at: string;
}

export const AdminAlertRules: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [ruleType, setRuleType] = useState('MATURITY_REMINDER');
  const [days, setDays] = useState(90);
  const [recipientRole, setRecipientRole] = useState('INSTITUTION');
  const [channels, setChannels] = useState<string[]>(['EMAIL', 'IN_APP']);
  const [escalateAfterDays, setEscalateAfterDays] = useState<number | ''>('');
  const [isActive, setIsActive] = useState(true);

  const { data: rules, isLoading, error } = useQuery({
    queryKey: queryKeys.alerts.rules,
    queryFn: async () => {
      const res = await apiClient.get('/admin/alert-rules');
      return res.data;
    },
  });

  const handleToggleChannel = (ch: string) => {
    if (channels.includes(ch)) {
      if (channels.length > 1) {
        setChannels(channels.filter((c) => c !== ch));
      }
    } else {
      setChannels([...channels, ch]);
    }
  };

  // Plain English sentence preview generator
  const getSentencePreview = () => {
    const channelList = channels.join(' and ');
    let triggerText = '';
    if (ruleType === 'MATURITY_REMINDER') {
      triggerText = `an instrument is within ${days} days of maturity`;
    } else if (ruleType === 'OVERDUE_MATURED') {
      triggerText = `an instrument is overdue past maturity by ${days} days`;
    } else if (ruleType === 'STALE_VERIFICATION') {
      triggerText = `a submission remains in scrutiny without action for ${days} days`;
    } else if (ruleType === 'DISCREPANCY_UNRESOLVED') {
      triggerText = `a discrepancy remains unresolved by the institution for ${days} days`;
    } else {
      triggerText = `a release request is pending for ${days} days`;
    }

    const escalationText = escalateAfterDays
      ? `, escalating to supervisor after ${escalateAfterDays} days`
      : '';

    return `Send an alert via ${channelList} to ${recipientRole} when ${triggerText}${escalationText}.`;
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (days <= 0) {
      toastError('Invalid Days', 'Days must be greater than zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post('/admin/alert-rules', {
        name,
        rule_type: ruleType,
        days: Number(days),
        recipient_role: recipientRole,
        channels,
        escalate_after_days: escalateAfterDays ? Number(escalateAfterDays) : null,
        is_active: isActive,
      });
      success('Rule Configured', `Alert rule '${name}' created.`);
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts.rules });
      setIsModalOpen(false);
      setName('');
      setDays(90);
    } catch (err: any) {
      toastError('Creation Failed', err.response?.data?.detail || 'Could not save alert rule.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (rule: AlertRule) => {
    try {
      await apiClient.patch(`/admin/alert-rules/${rule.id}`, {
        is_active: !rule.is_active,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts.rules });
      success('Rule Updated', `Rule '${rule.name}' is now ${!rule.is_active ? 'active' : 'inactive'}.`);
    } catch (err: any) {
      toastError('Update Failed', err.response?.data?.detail || 'Could not update rule.');
    }
  };

  const columns: Column<AlertRule>[] = [
    {
      key: 'name',
      header: 'Rule Name & Trigger',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-900">{row.name}</p>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            {row.rule_type} ({row.days} days)
          </p>
        </div>
      ),
    },
    {
      key: 'recipient_role',
      header: 'Recipient Role',
      render: (row) => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
          {row.recipient_role}
        </span>
      ),
    },
    {
      key: 'channels',
      header: 'Delivery Channels',
      render: (row) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          {row.channels?.map((ch) => (
            <span key={ch} className="text-[11px] font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700">
              {ch}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'escalate_after_days',
      header: 'Escalation Window',
      render: (row) =>
        row.escalate_after_days ? (
          <span className="text-xs font-medium text-amber-700">
            Escalates after {row.escalate_after_days}d
          </span>
        ) : (
          <span className="text-xs text-slate-400">No escalation</span>
        ),
    },
    {
      key: 'is_active',
      header: 'Active State',
      render: (row) => (
        <button
          type="button"
          onClick={() => handleToggleActive(row)}
          className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full transition-colors ${
            row.is_active
              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {row.is_active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
          <span>{row.is_active ? 'Active' : 'Inactive'}</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alert Rules & Automated Scan Configuration"
        subtitle="Manage maturity notification cadences, SLA escalation schedules, and delivery channels"
        breadcrumbs={[
          { label: 'Home', path: '/' },
          { label: 'Administration' },
          { label: 'Alert Rules' },
        ]}
        actions={
          <Button
            variant="black"
            size="md"
            onClick={() => setIsModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create Alert Rule
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={rules || []}
        isLoading={isLoading}
        error={error ? 'Failed to fetch alert rules.' : null}
      />

      {/* Modal with Live Plain-English Preview */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          role="dialog"
        >
          <div className="w-full max-w-lg bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Define New Alert Trigger Rule</h3>
            </div>

            <form onSubmit={handleCreateRule} className="p-5 space-y-4 text-xs">
              {/* Plain English Sentence Preview */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-xs">
                <span className="font-bold block uppercase tracking-wide text-[10px] text-blue-700 mb-1">
                  Live Rule Logic Preview:
                </span>
                <p className="font-medium italic leading-relaxed">"{getSentencePreview()}"</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rule Friendly Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 90-Day Early Maturity Notice"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Rule Event Type *</label>
                  <select
                    value={ruleType}
                    onChange={(e) => setRuleType(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="MATURITY_REMINDER">Maturity Reminder</option>
                    <option value="OVERDUE_MATURED">Overdue Past Maturity</option>
                    <option value="STALE_VERIFICATION">Stale Scrutiny SLA</option>
                    <option value="DISCREPANCY_UNRESOLVED">Unresolved Discrepancy</option>
                    <option value="RELEASE_PENDING">Release Review Pending</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Threshold Days *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded text-sm font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Recipient Role *</label>
                  <select
                    value={recipientRole}
                    onChange={(e) => setRecipientRole(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="INSTITUTION">Institution Representative</option>
                    <option value="VERIFYING_OFFICER">Verifying Officer</option>
                    <option value="APPROVING_AUTHORITY">Approving Authority</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Escalate After (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    placeholder="Optional (e.g. 3)"
                    value={escalateAfterDays}
                    onChange={(e) =>
                      setEscalateAfterDays(e.target.value ? Number(e.target.value) : '')
                    }
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded text-sm font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Notification Delivery Channels *
                </label>
                <div className="flex gap-4">
                  {['EMAIL', 'SMS', 'IN_APP'].map((ch) => (
                    <label key={ch} className="flex items-center gap-1.5 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={channels.includes(ch)}
                        onChange={() => handleToggleChannel(ch)}
                        className="rounded text-primary focus:ring-primary"
                      />
                      <span>{ch}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button variant="black" size="sm" type="submit" isLoading={isSubmitting}>
                  Save Alert Rule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
