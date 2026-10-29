import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Shield, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiClient } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { formatDateIST } from '../../utils/formatters';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

interface UserRecord {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone?: string | null;
  is_active: boolean;
  created_at: string;
}

export const AdminUsers: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('VERIFYING_OFFICER');
  const [phone, setPhone] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.admin.users({ page, pageSize }),
    queryFn: async () => {
      const res = await apiClient.get('/admin/users', {
        params: { page, page_size: pageSize },
      });
      return res.data;
    },
  });

  const users: UserRecord[] = data?.items || [];
  const total = data?.total || 0;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiClient.post('/admin/users', {
        email,
        password,
        full_name: fullName,
        role,
        phone: phone || undefined,
      });
      success('User Created', `Account created for ${fullName} with role ${role}.`);
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
      setIsModalOpen(false);
      setEmail('');
      setPassword('');
      setFullName('');
      setPhone('');
    } catch (err: any) {
      toastError('Creation Failed', err.response?.data?.detail || 'Could not create user account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<UserRecord>[] = [
    {
      key: 'full_name',
      header: 'Full Name',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-900">{row.full_name}</p>
          <p className="text-xs text-slate-500">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'System Role',
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
          <Shield className="w-3 h-3 text-slate-500" />
          {row.role}
        </span>
      ),
    },
    {
      key: 'phone',
      header: 'Contact Number',
      render: (row) => row.phone || '—',
    },
    {
      key: 'is_active',
      header: 'Account Status',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
            row.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {row.is_active ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
          {row.is_active ? 'Active' : 'Disabled'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created On',
      render: (row) => formatDateIST(row.created_at),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="User & Access Directory"
        subtitle="Manage government officers, institutional signatories, and administrative staff"
        breadcrumbs={[
          { label: 'Home', path: '/' },
          { label: 'Administration' },
          { label: 'Users' },
        ]}
        actions={
          <Button
            variant="black"
            size="md"
            onClick={() => setIsModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create New User
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={users}
        isLoading={isLoading}
        error={error ? 'Failed to fetch user directory.' : null}
        page={page}
        pageSize={pageSize}
        totalRecords={total}
        onPageChange={setPage}
      />

      {/* Create User Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          role="dialog"
        >
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Add Portal User Account</h3>
            </div>
            <form onSubmit={handleCreateUser} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Dr. Rajesh Kumar"
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Official Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@aicte-india.org"
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Initial Password *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Role *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="VERIFYING_OFFICER">Verifying Officer</option>
                  <option value="APPROVING_AUTHORITY">Approving Authority</option>
                  <option value="ADMIN">Portal Administrator</option>
                  <option value="INSTITUTION">Institution Representative</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Mobile Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
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
                  Save User
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
