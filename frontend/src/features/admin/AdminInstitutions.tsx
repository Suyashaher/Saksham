import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, MapPin, Search } from 'lucide-react';
import { apiClient } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { FilterBar } from '../../components/ui/FilterBar';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

interface InstitutionRecord {
  id: string;
  name: string;
  aicte_id: string;
  state: string;
  city?: string;
  address?: string;
  contact_email?: string;
  created_at: string;
}

export const AdminInstitutions: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [aicteId, setAicteId] = useState('');
  const [stateName, setStateName] = useState('Delhi');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.admin.institutions({ page, pageSize, search, state: stateFilter }),
    queryFn: async () => {
      const params: Record<string, any> = { page, page_size: pageSize };
      if (search) params.search = search;
      if (stateFilter) params.state = stateFilter;

      const res = await apiClient.get('/admin/institutions', { params });
      return res.data;
    },
  });

  const institutions: InstitutionRecord[] = data?.items || [];
  const total = data?.total || 0;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiClient.post('/admin/institutions', {
        name,
        aicte_id: aicteId,
        state: stateName,
        city,
        address,
        contact_email: contactEmail,
      });
      success('Institution Added', `${name} registered successfully.`);
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.institutions() });
      setIsModalOpen(false);
      setName('');
      setAicteId('');
      setCity('');
      setAddress('');
      setContactEmail('');
    } catch (err: any) {
      toastError('Registration Failed', err.response?.data?.detail || 'Could not register institution.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<InstitutionRecord>[] = [
    {
      key: 'aicte_id',
      header: 'AICTE Institute ID',
      render: (row) => (
        <span className="font-mono font-bold text-primary">{row.aicte_id}</span>
      ),
    },
    {
      key: 'name',
      header: 'Institution Legal Name',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-900">{row.name}</p>
          <p className="text-xs text-slate-500">{row.contact_email}</p>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'State & Region',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-slate-700">
          <MapPin className="w-3.5 h-3.5 text-slate-400" />
          <span>{row.city ? `${row.city}, ${row.state}` : row.state}</span>
        </div>
      ),
    },
    {
      key: 'address',
      header: 'Campus Address',
      render: (row) => <span className="text-xs text-slate-500 line-clamp-1">{row.address || '—'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accredited Institutions Registry"
        subtitle="Approved technical colleges, polytechnics, and universities under AICTE oversight"
        breadcrumbs={[
          { label: 'Home', path: '/' },
          { label: 'Administration' },
          { label: 'Institutions' },
        ]}
        actions={
          <Button
            variant="black"
            size="md"
            onClick={() => setIsModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Register Institution
          </Button>
        }
      />

      <FilterBar
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search by Institute ID or Legal Name..."
        onReset={() => {
          setSearch('');
          setStateFilter('');
          setPage(1);
        }}
      />

      <DataTable
        columns={columns}
        data={institutions}
        isLoading={isLoading}
        error={error ? 'Failed to fetch institution registry.' : null}
        page={page}
        pageSize={pageSize}
        totalRecords={total}
        onPageChange={setPage}
      />

      {/* Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          role="dialog"
        >
          <div className="w-full max-w-lg bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Register New Technical Institute</h3>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Permanent AICTE ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="1-281412345"
                    value={aicteId}
                    onChange={(e) => setAicteId(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded font-mono text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">State / UT *</label>
                  <input
                    type="text"
                    required
                    placeholder="Maharashtra"
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Institution Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. National Institute of Technology"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Contact Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="registrar@institute.edu.in"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Campus Address</label>
                  <textarea
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Sector 12, Institutional Area..."
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
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
                  Register Institute
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
