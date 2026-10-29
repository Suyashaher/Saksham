import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Code2, AlertCircle } from 'lucide-react';
import { apiClient } from '../../api/client';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

export const ReportsPage: React.FC = () => {
  const { success, error: toastError } = useToast();
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'pdf' | 'json'>('csv');
  const [status, setStatus] = useState('');
  const [bankName, setBankName] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  const handleExport = async () => {
    setIsDownloading(true);
    try {
      const params: Record<string, any> = { format };
      if (status) params.status = status;
      if (bankName) params.bank_name = bankName;
      if (dateFrom) params.maturity_from = dateFrom;
      if (dateTo) params.maturity_to = dateTo;

      const res = await apiClient.get('/reports/export', {
        params,
        responseType: format === 'json' ? 'json' : 'blob',
      });

      let blob: Blob;
      let filename = `AICTE_FDR_Report_${new Date().toISOString().split('T')[0]}.${format}`;

      if (format === 'json') {
        blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      } else {
        const mimeTypes: Record<string, string> = {
          csv: 'text/csv',
          xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          pdf: 'application/pdf',
        };
        blob = new Blob([res.data], { type: mimeTypes[format] || 'application/octet-stream' });
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      success('Report Export Complete', `Downloaded ${filename}`);
    } catch (err: any) {
      toastError('Export Failed', err.response?.data?.detail || 'Unable to generate export report.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Statutory Reports & Data Export"
        subtitle="Generate certified institutional portfolio summaries, maturity ledgers, and audit-ready exports"
        breadcrumbs={[
          { label: 'Home', path: '/' },
          { label: 'Reports & Export' },
        ]}
      />

      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-6">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Select Export Format
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: 'csv', label: 'CSV Ledger', icon: FileSpreadsheet, desc: 'Spreadsheet import' },
              { id: 'xlsx', label: 'Excel (XLSX)', icon: FileSpreadsheet, desc: 'Formatted tables' },
              { id: 'pdf', label: 'Official PDF', icon: FileText, desc: 'AICTE watermarked' },
              { id: 'json', label: 'JSON Dataset', icon: Code2, desc: 'Raw data feed' },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = format === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setFormat(item.id as any)}
                  className={`p-3.5 border rounded-lg cursor-pointer transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 mb-1.5 ${isSelected ? 'text-primary' : 'text-slate-500'}`}
                  />
                  <p className={`text-xs font-bold ${isSelected ? 'text-primary-dark' : 'text-slate-800'}`}>
                    {item.label}
                  </p>
                  <p className="text-[10px] text-slate-500">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4 space-y-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
            Export Scope & Filter Bounds
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Status Scope</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary text-slate-700"
              >
                <option value="">All Lifecycle Statuses</option>
                <option value="ACTIVE">Active & Valid</option>
                <option value="EXPIRING">Expiring Soon</option>
                <option value="MATURED">Matured / Overdue</option>
                <option value="RENEWED">Renewed</option>
                <option value="RELEASED">Released & Discharged</option>
                <option value="UNDER_SCRUTINY">Under Scrutiny</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Bank Name Filter</label>
              <input
                type="text"
                placeholder="e.g. State Bank of India"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary text-slate-700"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Maturity Date From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary text-slate-700"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Maturity Date To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary text-slate-700"
              />
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            Certified Export Note: Reports generated via this console include digital signature blocks and
            SHA-256 audit reference stamps. Maximum export window is 5,000 records.
          </span>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            variant="primary"
            size="md"
            onClick={handleExport}
            isLoading={isDownloading}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Generate & Download Export
          </Button>
        </div>
      </div>
    </div>
  );
};
