import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileCheck2, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { apiClient } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

interface ReleaseCondition {
  id: string;
  code: string;
  name: string;
  description?: string;
  check_type: 'AUTOMATIC' | 'MANUAL';
  is_mandatory: boolean;
  is_active: boolean;
  created_at: string;
}

export const AdminReleaseConditions: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [checkType, setCheckType] = useState<'AUTOMATIC' | 'MANUAL'>('MANUAL');
  const [isMandatory, setIsMandatory] = useState(true);

  const { data: conditions, isLoading, error } = useQuery({
    queryKey: queryKeys.admin.releaseConditions,
    queryFn: async () => {
      const res = await apiClient.get('/admin/release-conditions');
      return res.data;
    },
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiClient.post('/admin/release-conditions', {
        code,
        name,
        description,
        check_type: checkType,
        is_mandatory: isMandatory,
        is_active: true,
      });
      success('Condition Added', `Condition '${name}' saved.`);
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.releaseConditions });
      setIsModalOpen(false);
      setCode('');
      setName('');
      setDescription('');
    } catch (err: any) {
      toastError('Creation Failed', err.response?.data?.detail || 'Could not save condition.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<ReleaseCondition>[] = [
    {
      key: 'code',
      header: 'Condition Code',
      render: (row) => (
        <span className="font-mono font-bold text-slate-900 text-xs">{row.code}</span>
      ),
    },
    {
      key: 'name',
      header: 'Criteria Name & Description',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-800">{row.name}</p>
          <p className="text-xs text-slate-500">{row.description}</p>
        </div>
      ),
    },
    {
      key: 'check_type',
      header: 'Evaluation Type',
      render: (row) => (
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded ${
            row.check_type === 'AUTOMATIC'
              ? 'bg-blue-50 text-blue-700'
              : 'bg-purple-50 text-purple-700'
          }`}
        >
          {row.check_type}
        </span>
      ),
    },
    {
      key: 'is_mandatory',
      header: 'Requirement Priority',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded ${
            row.is_mandatory ? 'bg-red-50 text-red-800' : 'bg-slate-100 text-slate-700'
          }`}
        >
          {row.is_mandatory ? 'MANDATORY' : 'OPTIONAL'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statutory Release Conditions Catalog"
        subtitle="Configure criteria checklist evaluated prior to security deposit discharge authorization"
        breadcrumbs={[
          { label: 'Home', path: '/' },
          { label: 'Administration' },
          { label: 'Release Conditions' },
        ]}
        actions={
          <Button
            variant="black"
            size="md"
            onClick={() => setIsModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Condition
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={conditions || []}
        isLoading={isLoading}
        error={error ? 'Failed to fetch release conditions.' : null}
      />

      {/* Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          role="dialog"
        >
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Define Statutory Check Condition</h3>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Condition Code (Uppercase) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="COND_NO_OUTSTANDING_DUES"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded font-mono text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Condition Display Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="No Outstanding AICTE Dues or Penalties"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Evaluation Mechanism *
                </label>
                <select
                  value={checkType}
                  onChange={(e) => setCheckType(e.target.value as any)}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="MANUAL">Manual Officer Checklist</option>
                  <option value="AUTOMATIC">Automated System Query</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Detailed Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Verify that the regional office clearance certificate is attached..."
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={isMandatory}
                    onChange={(e) => setIsMandatory(e.target.checked)}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span className="font-semibold text-slate-800">
                    Mandatory Pre-condition (Must PASS before release is authorized)
                  </span>
                </label>
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
                  Save Condition
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
