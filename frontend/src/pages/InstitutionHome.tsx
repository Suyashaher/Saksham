import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet,
  AlertTriangle,
  Clock,
  PlusCircle,
  FileText,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { queryKeys } from '../api/queryKeys';
import { formatINR, formatDateIST, getDaysRemaining } from '../utils/formatters';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { useAuth } from '../features/auth/AuthContext';

export const InstitutionHome: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: instrumentsData, isLoading } = useQuery({
    queryKey: queryKeys.instruments.list({ page: 1, pageSize: 50 }),
    queryFn: async () => {
      const res = await apiClient.get('/instruments', { params: { page: 1, page_size: 50 } });
      return res.data;
    },
  });

  const instruments = instrumentsData?.items || [];

  // Metrics computation
  const totalAmount = instruments.reduce(
    (acc: number, curr: any) => acc + (Number(curr.amount) || 0),
    0
  );
  const actionRequiredItems = instruments.filter((item: any) =>
    ['DISCREPANCY', 'EXPIRING', 'MATURED'].includes(item.status)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${user?.full_name || 'Institution Representative'}`}
        subtitle="AICTE Fixed Deposit & Security Deposit Institutional Portal"
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/instruments/new')}
            leftIcon={<PlusCircle className="w-4 h-4" />}
          >
            Submit New FDR
          </Button>
        }
      />

      {/* StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total FDR Instruments"
          value={instruments.length}
          subtitle="Submitted across all programs"
          icon={<FileSpreadsheet className="w-5 h-5 text-primary" />}
        />
        <StatCard
          title="Total Guaranteed Corpus"
          value={formatINR(totalAmount)}
          subtitle="Under joint AICTE holding"
          icon={<ShieldCheck className="w-5 h-5 text-emerald-600" />}
          variant="primary"
        />
        <StatCard
          title="Actions Required"
          value={actionRequiredItems.length}
          subtitle="Discrepancies, expiring or overdue"
          icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
          variant={actionRequiredItems.length > 0 ? 'warning' : 'default'}
          onClick={() => navigate('/instruments?status=EXPIRING')}
        />
        <StatCard
          title="Account Statement"
          value="PDF Ready"
          subtitle="Certified deposit ledger"
          icon={<FileText className="w-5 h-5 text-teal-600" />}
          onClick={() => navigate('/reports')}
        />
      </div>

      {/* Action Required Callout Banner */}
      {actionRequiredItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span>Immediate Attention Required ({actionRequiredItems.length} Instruments)</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/instruments')}
              className="text-xs border-amber-300 text-amber-900 hover:bg-amber-100"
            >
              View All Instruments
            </Button>
          </div>

          <div className="divide-y divide-amber-200 text-xs">
            {actionRequiredItems.slice(0, 3).map((item: any) => {
              const days = getDaysRemaining(item.maturity_date);
              return (
                <div
                  key={item.id}
                  className="py-2.5 flex items-center justify-between hover:bg-amber-100/50 rounded px-2 cursor-pointer transition-colors"
                  onClick={() => navigate(`/instruments/${item.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <StatusBadge status={item.status} size="sm" />
                    <div>
                      <span className="font-mono font-semibold text-slate-900">{item.fdr_number}</span>
                      <span className="text-slate-600 ml-2">
                        {item.bank_name} • {formatINR(item.amount)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-amber-800 font-medium">
                      {days !== null && days < 0
                        ? `Overdue by ${Math.abs(days)}d`
                        : `${days}d left until maturity`}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-amber-700" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Deposits & Quick Access */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Your Institutional Deposits</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/instruments')}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Open Complete Portfolio
          </Button>
        </div>

        {instruments.length > 0 ? (
          <div className="divide-y divide-slate-200">
            {instruments.slice(0, 5).map((row: any) => (
              <div
                key={row.id}
                onClick={() => navigate(`/instruments/${row.id}`)}
                className="py-3.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {row.fdr_number}
                    </span>
                    <StatusBadge status={row.status} size="sm" />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {row.bank_name} ({row.branch_name}) • Matures: {formatDateIST(row.maturity_date)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{formatINR(row.amount)}</p>
                  <span className="text-[11px] text-primary hover:underline font-medium">
                    View Details →
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 py-6 text-center">
            No deposits found. Click "Submit New FDR" above to submit your first deposit receipt.
          </p>
        )}
      </div>
    </div>
  );
};
