import React, { useState } from 'react';
import { PlayCircle, Clock, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { apiClient } from '../../api/client';
import { formatDateIST } from '../../utils/formatters';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

export const AdminDemoRunner: React.FC = () => {
  const { success, error: toastError } = useToast();
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [dryRun, setDryRun] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [scanResult, setScanResult] = useState<any | null>(null);

  const handleRunScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRunning(true);
    setScanResult(null);

    try {
      const res = await apiClient.post('/admin/jobs/run-daily-scan', {
        as_of_date: asOfDate,
        dry_run: dryRun,
      });
      setScanResult(res.data);
      success(
        'Daily Scan Completed',
        `Evaluated instruments as of ${formatDateIST(asOfDate)}. Dry run: ${dryRun ? 'YES' : 'NO'}`
      );
    } catch (err: any) {
      toastError('Scan Execution Failed', err.response?.data?.detail || 'Unable to execute daily scan.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Automated Job Trigger & Time-Warp Runner"
        subtitle="Simulate arbitrary calendar dates to trigger validity tracking, maturity transitions, and automated alert delivery"
        breadcrumbs={[
          { label: 'Home', path: '/' },
          { label: 'Administration' },
          { label: 'Demo Scan Runner' },
        ]}
      />

      {/* Prominent Amber Demo Mode Banner */}
      <div className="p-4 bg-amber-500 text-slate-950 font-bold rounded-lg shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 text-slate-950 shrink-0" />
          <div>
            <p className="text-sm uppercase tracking-wide">SIH Evaluation Demonstration Console</p>
            <p className="text-xs font-normal text-slate-900 mt-0.5">
              Simulates automated Celery cron jobs in-process using the backend Clock abstraction.
            </p>
          </div>
        </div>
        <span className="text-xs px-2.5 py-1 bg-slate-950 text-amber-400 rounded font-mono uppercase tracking-wider">
          Demo Mode Active
        </span>
      </div>

      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-6">
        <form onSubmit={handleRunScan} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Simulated Calendar Date (As-Of Date) *
              </label>
              <input
                type="date"
                required
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded text-sm font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                The daily scan job will evaluate maturity dates relative to this exact day.
              </p>
            </div>

            <div className="flex flex-col justify-center">
              <label className="flex items-center gap-2 cursor-pointer pt-3">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                />
                <div>
                  <span className="font-semibold text-slate-800 text-xs">
                    Dry Run Mode (Simulate Only)
                  </span>
                  <p className="text-[11px] text-slate-500">
                    If checked, will calculate transitions without committing database state changes.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-200">
            <Button
              type="submit"
              variant="black"
              size="md"
              isLoading={isRunning}
              leftIcon={<PlayCircle className="w-4 h-4" />}
            >
              Execute Daily Scan Job Now
            </Button>
          </div>
        </form>

        {/* Scan Results Card */}
        {scanResult && (
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Daily Scan Job Execution Output</span>
              </div>
              <span className="font-mono text-[11px] text-slate-500">
                Timestamp: {formatDateIST(new Date().toISOString(), true)}
              </span>
            </div>

            <pre className="p-3 bg-slate-900 text-slate-100 rounded text-[11px] font-mono overflow-x-auto">
              {JSON.stringify(scanResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
