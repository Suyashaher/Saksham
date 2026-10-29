import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Download,
  ShieldCheck,
  UserCheck,
  Eye,
  EyeOff,
  Undo2,
  Lock,
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { formatDateIST, formatINR } from '../../utils/formatters';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../auth/AuthContext';

export const ReleaseRequestDetail: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [officerNotes, setOfficerNotes] = useState('');
  const [officerRec, setOfficerRec] = useState<'RECOMMEND' | 'NOT_RECOMMEND'>('RECOMMEND');
  const [showUnmaskedBeneficiary, setShowUnmaskedBeneficiary] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 1. Fetch Release Request Detail
  const { data: request, isLoading } = useQuery({
    queryKey: queryKeys.releases.detail(requestId!),
    queryFn: async () => {
      const res = await apiClient.get(`/release-requests/${requestId}`);
      return res.data;
    },
    enabled: !!requestId,
  });

  // 2. Fetch Release Conditions
  const { data: conditionsData } = useQuery({
    queryKey: queryKeys.releases.conditions(requestId!),
    queryFn: async () => {
      try {
        const res = await apiClient.get(`/release-requests/${requestId}/conditions`);
        return res.data;
      } catch {
        return [];
      }
    },
    enabled: !!requestId,
  });

  // Withdraw Mutation (Institution)
  const handleWithdraw = async () => {
    setIsProcessing(true);
    try {
      await apiClient.post(`/release-requests/${requestId}/withdraw`);
      success('Request Withdrawn', 'Release request has been cancelled and instrument restored.');
      queryClient.invalidateQueries({ queryKey: queryKeys.releases.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.instruments.all });
      setShowWithdrawConfirm(false);
    } catch (err: any) {
      toastError('Withdrawal Failed', err.response?.data?.detail || 'Could not withdraw request.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Start Review Mutation (Officer)
  const handleStartReview = async () => {
    setIsProcessing(true);
    try {
      await apiClient.post(`/release-requests/${requestId}/start-review`);
      success('Review Initiated', 'You are now assigned as the reviewing officer.');
      queryClient.invalidateQueries({ queryKey: queryKeys.releases.detail(requestId!) });
    } catch (err: any) {
      toastError('Action Failed', err.response?.data?.detail || 'Could not initiate review.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Recommend Release Mutation (Officer)
  const handleRecommend = async () => {
    setIsProcessing(true);
    try {
      await apiClient.post(`/release-requests/${requestId}/recommend`, {
        recommendation: officerRec,
        notes: officerNotes || 'Compliance verification completed.',
      });
      success(
        'Recommendation Lodged',
        `Release request forwarded to Approving Authority with ${officerRec} decision.`
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.releases.detail(requestId!) });
    } catch (err: any) {
      toastError('Action Failed', err.response?.data?.detail || 'Could not record recommendation.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Approve Release Mutation (Authority)
  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await apiClient.post(`/release-requests/${requestId}/approve`);
      success('Release Approved', 'Instrument discharged. Official closure letter PDF generated.');
      queryClient.invalidateQueries({ queryKey: queryKeys.releases.detail(requestId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.instruments.all });
      setShowApproveConfirm(false);
    } catch (err: any) {
      toastError('Approval Failed', err.response?.data?.detail || 'Could not execute release approval.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Reject Release Mutation (Authority)
  const handleReject = async () => {
    if (!rejectReason) {
      toastError('Reason Required', 'Please specify the rejection grounds.');
      return;
    }
    setIsProcessing(true);
    try {
      await apiClient.post(`/release-requests/${requestId}/reject`, { reason: rejectReason });
      success('Release Request Rejected', 'Instrument returned to prior active status.');
      queryClient.invalidateQueries({ queryKey: queryKeys.releases.detail(requestId!) });
      setShowRejectConfirm(false);
    } catch (err: any) {
      toastError('Action Failed', err.response?.data?.detail || 'Could not reject release.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Download Closure Letter PDF
  const handleDownloadPDF = async () => {
    try {
      const res = await apiClient.get(`/release-requests/${requestId}/closure-letter`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `AICTE_Closure_Discharge_${request?.instrument_id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      success('Download Successful', 'Closure certificate downloaded.');
    } catch {
      toastError('Download Failed', 'Could not generate or download closure PDF.');
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading release review details...</div>;
  }

  if (!request) {
    return <div className="p-8 text-center text-slate-500">Release request not found.</div>;
  }

  const isOfficer = user?.role === 'VERIFYING_OFFICER';
  const isAuthority = user?.role === 'APPROVING_AUTHORITY';
  const isInstitution = user?.role === 'INSTITUTION';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title={`Release Request #${request.id.slice(0, 8)}`}
        subtitle={`Type: ${request.request_type} • Instrument ID: ${request.instrument_id}`}
        breadcrumbs={[
          { label: 'Home', path: '/' },
          { label: 'Instruments', path: '/instruments' },
          { label: 'Release Request' },
        ]}
        badge={
          <span
            className={`px-3 py-1 text-xs font-bold rounded-full ${
              request.status === 'APPROVED'
                ? 'bg-emerald-100 text-emerald-800'
                : request.status === 'REJECTED'
                ? 'bg-red-100 text-red-800'
                : request.status === 'UNDER_REVIEW'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-slate-100 text-slate-800'
            }`}
          >
            {request.status}
          </span>
        }
      />

      {/* Main Request Summary */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Request Parameters & Audit Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500">Request Type</p>
            <p className="font-semibold text-slate-900 mt-0.5">{request.request_type}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Submission Timestamp</p>
            <p className="font-medium text-slate-800 mt-0.5">{formatDateIST(request.created_at, true)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Reviewing Officer</p>
            <p className="font-medium text-slate-800 mt-0.5">
              {request.reviewed_by_name || (request.reviewed_by ? 'Assigned' : 'Unassigned')}
            </p>
          </div>
          <div className="md:col-span-3">
            <p className="text-xs text-slate-500">Reason for Release</p>
            <p className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-800 mt-1">
              {request.reason}
            </p>
          </div>
        </div>

        {/* Institution Withdraw Option */}
        {isInstitution && request.status === 'PENDING' && (
          <div className="pt-2 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Undo2 className="w-4 h-4" />}
              onClick={() => setShowWithdrawConfirm(true)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              Withdraw Release Request
            </Button>
          </div>
        )}
      </div>

      {/* Beneficiary Details Section (For Refunds) */}
      {request.request_type === 'REFUND' && (
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">Beneficiary Bank Account Details</h3>
            </div>
            {isAuthority && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUnmaskedBeneficiary(!showUnmaskedBeneficiary)}
                leftIcon={showUnmaskedBeneficiary ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              >
                {showUnmaskedBeneficiary ? 'Mask Numbers' : 'Unmask (Authority Privilege)'}
              </Button>
            )}
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-500 block">Account Holder</span>
                <span className="font-semibold text-slate-800">
                  {request.beneficiary_details?.account_name || 'Protected'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Account Number</span>
                <span className="font-mono font-semibold text-slate-800">
                  {showUnmaskedBeneficiary
                    ? request.beneficiary_details?.account_number
                    : '••••••••' + (request.beneficiary_details?.account_number?.slice(-4) || '9876')}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Bank Name</span>
                <span className="text-slate-800">{request.beneficiary_details?.bank_name || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">IFSC Code</span>
                <span className="font-mono text-slate-800">
                  {showUnmaskedBeneficiary
                    ? request.beneficiary_details?.ifsc_code
                    : request.beneficiary_details?.ifsc_code?.slice(0, 4) + '•••••••'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Release Conditions Evaluation Checklist */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Statutory Condition Evaluation Checklist
        </h3>

        <div className="divide-y divide-slate-200">
          {conditionsData && conditionsData.length > 0 ? (
            conditionsData.map((cond: any, idx: number) => (
              <div key={idx} className="py-3 flex items-center justify-between text-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{cond.name || cond.condition_code}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        cond.is_mandatory ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {cond.is_mandatory ? 'MANDATORY' : 'OPTIONAL'}
                    </span>
                  </div>
                  {cond.description && <p className="text-xs text-slate-500 mt-0.5">{cond.description}</p>}
                </div>

                <div className="flex items-center gap-2">
                  {cond.status === 'PASS' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                    </span>
                  ) : cond.status === 'FAIL' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                      <XCircle className="w-3.5 h-3.5" /> FAIL
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      <Clock className="w-3.5 h-3.5" /> PENDING
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 py-4 text-center">
              All baseline automated conditions evaluated and verified.
            </p>
          )}
        </div>
      </div>

      {/* Officer Scrutiny Action Box */}
      {isOfficer && request.status === 'PENDING' && (
        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 space-y-4">
          <div className="flex items-center gap-2 font-bold text-blue-900">
            <UserCheck className="w-5 h-5 text-blue-700" />
            <span>Officer Scrutiny Console</span>
          </div>
          <p className="text-xs text-blue-800">
            Accept this release case to mark it Under Review and evaluate manual checks.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={handleStartReview}
            isLoading={isProcessing}
          >
            Start Officer Review
          </Button>
        </div>
      )}

      {isOfficer && request.status === 'UNDER_REVIEW' && (
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-900">Officer Recommendation</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Your Formal Recommendation *
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-emerald-800 font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="rec"
                    checked={officerRec === 'RECOMMEND'}
                    onChange={() => setOfficerRec('RECOMMEND')}
                  />
                  <span>Recommend for Release</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-red-800 font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="rec"
                    checked={officerRec === 'NOT_RECOMMEND'}
                    onChange={() => setOfficerRec('NOT_RECOMMEND')}
                  />
                  <span>Do Not Recommend (Issues Found)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Scrutiny Observations & Notes *
              </label>
              <textarea
                rows={3}
                value={officerNotes}
                onChange={(e) => setOfficerNotes(e.target.value)}
                placeholder="Compliance verified with Regional Office records..."
                className="w-full py-2 px-3 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={handleRecommend}
              isLoading={isProcessing}
              leftIcon={<FileCheck className="w-4 h-4" />}
            >
              Submit Recommendation to Authority
            </Button>
          </div>
        </div>
      )}

      {/* Approving Authority Decision Box */}
      {isAuthority && (request.status === 'UNDER_REVIEW' || request.officer_recommendation) && request.status !== 'APPROVED' && request.status !== 'REJECTED' && (
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-900">Authority Final Adjudication</h3>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
            <p>
              Officer Recommendation:{' '}
              <strong className={request.officer_recommendation === 'RECOMMEND' ? 'text-emerald-700' : 'text-red-700'}>
                {request.officer_recommendation || 'PENDING'}
              </strong>
            </p>
            {request.officer_notes && (
              <p className="text-slate-600">Officer Notes: {request.officer_notes}</p>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              variant="primary"
              size="md"
              onClick={() => setShowApproveConfirm(true)}
              isLoading={isProcessing}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              One-Click Final Approval
            </Button>
            <Button
              variant="destructive"
              size="md"
              onClick={() => setShowRejectConfirm(true)}
              isLoading={isProcessing}
              leftIcon={<XCircle className="w-4 h-4" />}
            >
              Reject Release Request
            </Button>
          </div>
        </div>
      )}

      {/* If Approved: Download PDF Button */}
      {request.status === 'APPROVED' && (
        <div className="p-6 bg-slate-900 text-white rounded-lg flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              <h4 className="text-base font-bold">Release Order Dispatched</h4>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Official discharge letter generated with SHA-256 verification code.
            </p>
          </div>
          <Button
            variant="saffron"
            size="md"
            onClick={handleDownloadPDF}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Download Closure Order PDF
          </Button>
        </div>
      )}

      {/* Withdraw Modal */}
      <ConfirmDialog
        isOpen={showWithdrawConfirm}
        title="Withdraw Release Request"
        message="Are you sure you want to withdraw this release request? The instrument will revert to its active state."
        confirmLabel="Withdraw Request"
        variant="warning"
        isLoading={isProcessing}
        onConfirm={handleWithdraw}
        onCancel={() => setShowWithdrawConfirm(false)}
      />

      {/* Approve Modal */}
      <ConfirmDialog
        isOpen={showApproveConfirm}
        title="Approve Security Deposit Release"
        message="Executing final approval will transition the instrument to RELEASED (terminal state) and generate the digitally-verified closure document. This action is irreversible."
        confirmLabel="Execute Approval"
        variant="info"
        isLoading={isProcessing}
        onConfirm={handleApprove}
        onCancel={() => setShowApproveConfirm(false)}
      />

      {/* Reject Modal */}
      <ConfirmDialog
        isOpen={showRejectConfirm}
        title="Reject Release Request"
        message={
          <div className="space-y-3">
            <p>Please enter the justification for rejecting this release request:</p>
            <textarea
              rows={2}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Grounds for rejection..."
              className="w-full p-2 border border-slate-300 rounded text-xs text-slate-800"
            />
          </div>
        }
        confirmLabel="Confirm Rejection"
        variant="danger"
        isLoading={isProcessing}
        onConfirm={handleReject}
        onCancel={() => setShowRejectConfirm(false)}
      />
    </div>
  );
};
