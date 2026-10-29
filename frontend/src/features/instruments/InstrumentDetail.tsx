import React, { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  RefreshCw,
  Send,
  Building,
  Calendar,
  Lock,
  GitBranch,
  Plus,
  Upload,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { apiClient, formatApiError } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useDocumentRegistry } from '../../api/meta';
import { InstrumentTypeBadge } from '../../components/ui/InstrumentTypeBadge';
import { FileUpload } from '../../components/ui/FileUpload';
import { formatINR, formatDateIST, getDaysRemaining } from '../../utils/formatters';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { VerificationTag } from '../../components/ui/VerificationTag';
import { PageHeader } from '../../components/ui/PageHeader';
import { Timeline, TimelineItem } from '../../components/ui/Timeline';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../auth/AuthContext';
import { TrustScoreBadge } from '../../components/ui/ai/TrustScoreBadge';
import { PredictionChip } from '../../components/ui/ai/PredictionChip';
import { TrustInsightsCard } from '../ai/trust/TrustInsightsCard';
import { DocumentMismatchFlags } from '../ai/ocr/DocumentMismatchFlags';
import { OcrComparisonCard } from '../ai/ocr/OcrComparisonCard';
import { aiApi } from '../../api/ai';

export const InstrumentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const { user } = useAuth();
  const { data: registry } = useDocumentRegistry();

  const isOfficerOrAdmin = Boolean(
    user?.role && ['VERIFYING_OFFICER', 'APPROVING_AUTHORITY', 'ADMIN'].includes(user.role)
  );
  const isApproverOrAdmin = Boolean(
    user?.role && ['APPROVING_AUTHORITY', 'ADMIN'].includes(user.role)
  );

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDocType, setUploadDocType] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isStartingScrutiny, setIsStartingScrutiny] = useState(false);
  const [isVerifyingBank, setIsVerifyingBank] = useState(false);

  const handleStartScrutiny = async () => {
    setIsStartingScrutiny(true);
    try {
      await apiClient.post(`/instruments/${id}/start-scrutiny`);
      success('Scrutiny Commenced', 'Instrument moved to UNDER_SCRUTINY and assigned to you.');
      queryClient.invalidateQueries({ queryKey: queryKeys.instruments.detail(id!) });
      navigate(`/officer/scrutiny/${id}`);
    } catch (err: any) {
      toastError('Action Failed', formatApiError(err, 'Failed to start scrutiny.'));
    } finally {
      setIsStartingScrutiny(false);
    }
  };

  const handleVerifyWithBank = async () => {
    setIsVerifyingBank(true);
    try {
      const res = await apiClient.post(`/instruments/${id}/verify`);
      if (res.data?.is_verified) {
        success('Bank Record Verified', 'Instrument details matched against official bank registry records.');
      } else {
        toastError('Verification Discrepancies', 'Bank registry query returned discrepancies. Review the comparison below.');
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.instruments.bankVerification(id!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.instruments.detail(id!) });
      setSearchParams({ tab: 'verification' });
    } catch (err: any) {
      toastError('Verification Failed', formatApiError(err, 'Failed to query bank registry.'));
    } finally {
      setIsVerifyingBank(false);
    }
  };

  const requestedTab = searchParams.get('tab') || 'overview';
  // Restrict scrutiny, verification, and internal AI tabs strictly to verifying officers and admins
  const activeTab = (!isOfficerOrAdmin && (requestedTab === 'verification' || requestedTab === 'ai_insights'))
    ? 'overview'
    : requestedTab;

  // 1. Fetch Instrument Details
  const {
    data: instrument,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.instruments.detail(id!),
    queryFn: async () => {
      const res = await apiClient.get(`/instruments/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  // 2. Fetch Bank Verification Record (Officer / Approver / Admin only)
  const { data: bankRecord } = useQuery({
    queryKey: queryKeys.instruments.bankVerification(id!),
    queryFn: async () => {
      try {
        const res = await apiClient.get(`/instruments/${id}/verification`);
        return res.data;
      } catch {
        return null;
      }
    },
    enabled: !!id && isOfficerOrAdmin,
  });

  // 3. Fetch Status History
  const { data: statusHistory } = useQuery({
    queryKey: queryKeys.instruments.statusHistory(id!),
    queryFn: async () => {
      try {
        const res = await apiClient.get(`/instruments/${id}/history`);
        return res.data;
      } catch {
        return [];
      }
    },
    enabled: !!id,
  });

  // 4. Fetch Documents
  const { data: rawDocuments } = useQuery({
    queryKey: queryKeys.instruments.documents(id!),
    queryFn: async () => {
      try {
        const res = await apiClient.get(`/instruments/${id}/documents`);
        return res.data;
      } catch {
        return [];
      }
    },
    enabled: !!id,
  });

  const documents: any[] = Array.isArray(rawDocuments)
    ? rawDocuments
    : Array.isArray(rawDocuments?.items)
    ? rawDocuments.items
    : [];

  // 5. Fetch Renewal Lineage
  const { data: lineage } = useQuery({
    queryKey: queryKeys.instruments.lineage(id!),
    queryFn: async () => {
      try {
        const res = await apiClient.get(`/instruments/${id}/lineage`);
        return res.data;
      } catch {
        return null;
      }
    },
    enabled: !!id,
  });

  // 6. Fetch Open Release Request if exists
  const { data: releaseRequests } = useQuery({
    queryKey: queryKeys.releases.list({ instrument_id: id }),
    queryFn: async () => {
      try {
        const res = await apiClient.get('/release-requests', {
          params: { instrument_id: id },
        });
        return res.data?.items || [];
      } catch {
        return [];
      }
    },
    enabled: !!id,
  });

  const latestReleaseRequest = releaseRequests && releaseRequests.length > 0 ? releaseRequests[0] : null;

  const [isActivating, setIsActivating] = useState(false);

  const handleActivate = async () => {
    setIsActivating(true);
    try {
      await apiClient.post(`/instruments/${id}/activate`);
      success('Instrument Approved & Activated', 'The deposit has transitioned to ACTIVE status.');
      queryClient.invalidateQueries({ queryKey: queryKeys.instruments.detail(id!) });
    } catch (err: any) {
      toastError('Activation Failed', formatApiError(err, 'Could not activate instrument.'));
    } finally {
      setIsActivating(false);
    }
  };

  const { data: trustData } = useQuery({
    queryKey: queryKeys.ai.trustScore(id!),
    queryFn: () => aiApi.getTrustScore(id!),
    enabled: !!id && isOfficerOrAdmin,
    staleTime: 60 * 1000,
  });

  const { data: predData } = useQuery({
    queryKey: queryKeys.ai.predictedTime(id!),
    queryFn: () => aiApi.getPredictedTime(id!),
    enabled: !!id && isOfficerOrAdmin,
    staleTime: 60 * 1000,
  });

  // Document download handler (AES decrypted blob)
  const handleDownloadDocument = async (docId: string, filename: string) => {
    try {
      const res = await apiClient.get(`/instruments/${id}/documents/${docId}/download`, {
        responseType: 'blob',
      });
      const contentType = (res.headers['content-type'] as string) || 'application/octet-stream';
      const blob = new Blob([res.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      success('Download complete', `${filename} decrypted successfully.`);
    } catch {
      toastError('Download failed', 'Could not retrieve encrypted document from storage.');
    }
  };

  // Closure Letter Download handler (if RELEASED)
  const handleDownloadClosureLetter = async (requestId: string) => {
    try {
      const res = await apiClient.get(`/release-requests/${requestId}/closure-letter`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `AICTE_Closure_Discharge_${instrument?.fdr_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      success('Closure Letter Downloaded', 'Official AICTE discharge order downloaded.');
    } catch {
      toastError('Download failed', 'Unable to retrieve closure letter.');
    }
  };

  const handleUploadDocument = async () => {
    if (!uploadFile || !uploadDocType) {
      toastError('Validation Error', 'Please select a document type and a file.');
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('doc_type', uploadDocType);
      await apiClient.post(`/instruments/${id}/documents/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      success('Document Uploaded', 'Document attached and submitted for verification.');
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadDocType('');
      queryClient.invalidateQueries({ queryKey: queryKeys.instruments.documents(id!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.instruments.detail(id!) });
    } catch (err: any) {
      toastError('Upload failed', formatApiError(err, 'Failed to upload document.'));
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading instrument details...</p>
      </div>
    );
  }

  if (error || !instrument) {
    return (
      <div className="p-8 text-center bg-white border border-red-200 rounded-lg">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <h3 className="text-base font-semibold text-slate-900">Instrument Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">
          The requested FDR ID does not exist or you do not have permission to view it.
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate(-1)}>
          Back to List
        </Button>
      </div>
    );
  }

  const daysRemaining = getDaysRemaining(instrument.maturity_date);
  const isJointHolderValid =
    instrument.joint_holder_name &&
    (instrument.joint_holder_name.toLowerCase().includes('aicte') ||
      instrument.joint_holder_name.toLowerCase().includes('all india council'));

  const timelineItems: TimelineItem[] = (statusHistory || []).map((h: any) => ({
    id: h.id || Math.random().toString(),
    title: `Transition to ${h.to_status}`,
    description: h.remarks || `Changed from ${h.from_status || 'Initial'} to ${h.to_status}`,
    timestamp: h.created_at,
    actor: h.changed_by_name || h.changed_by_role || 'SYSTEM',
    status: 'completed',
  }));

  const isBG = instrument.instrument_type === 'BANK_GUARANTEE';
  const displayRef = instrument.reference_number || instrument.fdr_number;

  const itype = instrument.instrument_type || 'FDR';
  const requiredDocTypes = itype === 'BANK_GUARANTEE'
    ? ['BANK_GUARANTEE_DOCUMENT', 'BANK_LETTER']
    : ['FDR_SCAN', 'DEPOSIT_CONFIRMATION'];

  const uploadedDocTypes = (documents || []).map((d: any) => d.doc_type || d.document_type);
  const missingDocCodes = requiredDocTypes.filter((code) => !uploadedDocTypes.includes(code));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${isBG ? 'Bank Guarantee' : 'FDR'}: ${displayRef}`}
        subtitle={`${instrument.bank_name || instrument.issuing_bank} • Branch: ${instrument.branch_name || instrument.branch || 'Main Branch'}`}
        breadcrumbs={[
          { label: 'Home', path: '/' },
          { label: 'Instruments', path: '/instruments' },
          { label: displayRef },
        ]}
        badge={
          <div className="flex flex-wrap items-center gap-2">
            <InstrumentTypeBadge type={instrument.instrument_type} size="md" />
            <StatusBadge status={instrument.status} size="md" />
            <VerificationTag
              isBankVerified={Boolean(instrument.is_verified || instrument.status === 'VERIFIED')}
              verifiedAt={instrument.bank_verified_at ? formatDateIST(instrument.bank_verified_at) : undefined}
            />
            {isOfficerOrAdmin && trustData && (
              <TrustScoreBadge
                score={trustData.score}
                band={trustData.band}
                reasons={trustData.factors}
                weightsVersion={trustData.weights_version}
                dataSource={trustData.data_source}
              />
            )}
            {isOfficerOrAdmin && predData?.verification && (
              <PredictionChip
                predictedDays={predData.verification.predicted_days}
                intervalLow={predData.verification.interval_low}
                intervalHigh={predData.verification.interval_high}
                isHeuristic={predData.verification.is_heuristic}
                modelVersion={predData.verification.model_version}
                dataSource={predData.verification.data_source}
                reasons={predData.verification.reasons}
                maturityDate={instrument.maturity_date}
              />
            )}
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isOfficerOrAdmin && instrument.status === 'SUBMITTED' && (
              <Button
                variant="black"
                size="sm"
                isLoading={isStartingScrutiny}
                leftIcon={<ShieldCheck className="w-4 h-4" />}
                onClick={handleStartScrutiny}
              >
                Start Officer Scrutiny
              </Button>
            )}

            {isOfficerOrAdmin && instrument.status === 'UNDER_SCRUTINY' && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  isLoading={isVerifyingBank}
                  leftIcon={<Building className="w-4 h-4" />}
                  onClick={handleVerifyWithBank}
                >
                  Verify with Bank
                </Button>
                <Button
                  variant="black"
                  size="sm"
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  onClick={() => navigate(`/officer/scrutiny/${id}`)}
                >
                  Open Scrutiny Workspace
                </Button>
              </>
            )}

            {isOfficerOrAdmin && instrument.status === 'VERIFIED' && (
              <>
                <Button
                  variant="black"
                  size="sm"
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  onClick={() => navigate(`/officer/scrutiny/${id}`)}
                >
                  Review in Scrutiny Workspace
                </Button>
                {isApproverOrAdmin && (
                  <Button
                    variant="black"
                    size="sm"
                    isLoading={isActivating}
                    leftIcon={<ShieldCheck className="w-4 h-4" />}
                    onClick={handleActivate}
                  >
                    Approve & Activate Deposit
                  </Button>
                )}
              </>
            )}

            {['ACTIVE', 'EXPIRING', 'MATURED'].includes(instrument.status) && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<RefreshCw className="w-4 h-4" />}
                  onClick={() => setSearchParams({ tab: 'renew' })}
                >
                  Renew FDR
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Send className="w-4 h-4" />}
                  onClick={() => setSearchParams({ tab: 'release' })}
                >
                  Request Release / Refund
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Non-blocking Warning Chips */}
      <div className="flex flex-wrap gap-2">
        {!isJointHolderValid && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-xs font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>
              Warning: Joint holder ({instrument.joint_holder_name}) does not explicitly designate AICTE.
            </span>
          </div>
        )}
        {daysRemaining !== null && daysRemaining <= 30 && daysRemaining > 0 && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-xs font-medium">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Maturity Warning: Deposit matures in {daysRemaining} days. Plan renewal or release.</span>
          </div>
        )}
        {daysRemaining !== null && daysRemaining <= 0 && instrument.status === 'MATURED' && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-50 text-red-800 border border-red-200 text-xs font-medium">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span>Overdue Matured: Security deposit expired on {formatDateIST(instrument.maturity_date)}.</span>
          </div>
        )}
        {instrument.status === 'RELEASED' && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 text-slate-100 text-xs font-medium">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span>Terminal State: This security deposit has been officially discharged and released.</span>
          </div>
        )}
      </div>

      {/* Tabs Bar */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6 text-sm font-medium">
          {[
            { id: 'overview', label: 'Overview & Details' },
            ...(isOfficerOrAdmin ? [{ id: 'ai_insights', label: 'AI Risk & Insights' }] : []),
            ...(isOfficerOrAdmin ? [{ id: 'verification', label: 'Verification & OCR Comparison' }] : []),
            { id: 'documents', label: `Documents (${documents?.length || 0})` },
            { id: 'timeline', label: 'Status History' },
            { id: 'lineage', label: 'Renewal Lineage' },
            { id: 'release', label: 'Release / Refund' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSearchParams({ tab: tab.id })}
              className={`pb-3 px-1 border-b-2 font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab 1: Overview & Details */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Statutory Lifecycle & Maturity Tracking Card */}
          <div className="md:col-span-2 p-5 bg-gradient-to-r from-slate-900 to-slate-950 text-white rounded-lg shadow-sm border border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-slate-800 text-emerald-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Statutory Maturity & Lifecycle Tracking
                  </h3>
                  <p className="text-xs text-slate-400">
                    Real-time countdown and statutory review schedule under AICTE Security Deposit norms
                  </p>
                </div>
              </div>

              <div>
                {daysRemaining !== null ? (
                  daysRemaining > 90 ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      {daysRemaining} Days Remaining (Active & In Good Standing)
                    </span>
                  ) : daysRemaining > 30 ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-700">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      {daysRemaining} Days Remaining (90-Day Renewal Window)
                    </span>
                  ) : daysRemaining > 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-950 text-orange-300 border border-orange-700 animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                      {daysRemaining} Days Remaining (Critical - Action Required)
                    </span>
                  ) : daysRemaining === 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-950 text-red-300 border border-red-700">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      Matures Today
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-950 text-red-300 border border-red-700">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      {Math.abs(daysRemaining)} Days Overdue Past Maturity
                    </span>
                  )
                ) : (
                  <span className="text-xs text-slate-400">Maturity Date Pending</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Issue Date:</span>
                <span className="font-semibold text-slate-100 mt-0.5 block">{formatDateIST(instrument.issue_date)}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Statutory Maturity Date:</span>
                <span className="font-semibold text-emerald-300 mt-0.5 block">{formatDateIST(instrument.maturity_date)}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Deposit Principal:</span>
                <span className="font-mono font-bold text-white text-sm mt-0.5 block">{formatINR(instrument.amount)}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Next Statutory Milestone:</span>
                <span className="text-slate-300 mt-0.5 block font-medium">
                  {daysRemaining !== null && daysRemaining <= 90
                    ? 'Renewal or Discharge Resolution'
                    : 'Annual Bank Standing Confirmation'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Financial & Deposit Parameters
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500">Principal Deposit Amount</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">
                  {formatINR(instrument.amount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Instrument Type</p>
                <div className="mt-1">
                  <InstrumentTypeBadge type={instrument.instrument_type} size="sm" />
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500">{isBG ? 'Effective / Issue Date' : 'Date of Issue'}</p>
                <p className="font-medium text-slate-800 mt-0.5">
                  {formatDateIST(instrument.issue_date)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{isBG ? 'Guarantee Expiry Date' : 'Date of Maturity'}</p>
                <p className="font-medium text-slate-800 mt-0.5">
                  {formatDateIST(instrument.maturity_date)}
                </p>
              </div>
              {isBG && instrument.claim_expiry_date && (
                <div>
                  <p className="text-xs text-slate-500">Claim Expiry Date</p>
                  <p className="font-medium text-slate-800 mt-0.5">
                    {formatDateIST(instrument.claim_expiry_date)}
                  </p>
                </div>
              )}
              <div className="col-span-2">
                <p className="text-xs text-slate-500">{isBG ? 'Beneficiary' : 'Joint Holding Title'}</p>
                <p className="font-medium text-slate-800 mt-0.5">
                  {isBG ? (instrument.beneficiary_name || 'AICTE') : (instrument.joint_holder_name || 'None')}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Issuing Bank & Branch Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="col-span-2">
                <p className="text-xs text-slate-500">Bank Name</p>
                <p className="text-base font-semibold text-slate-800 mt-0.5">
                  {instrument.bank_name}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Branch Name</p>
                <p className="font-medium text-slate-800 mt-0.5">{instrument.branch_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">IFSC Code</p>
                <p className="font-mono font-semibold text-slate-800 mt-0.5">
                  {instrument.ifsc_code}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-slate-500">Auto Renewal Clause</p>
                <p className="font-medium text-slate-800 mt-0.5">
                  {instrument.auto_renewal ? 'Enabled (Automatic Extension)' : 'Disabled (Requires Manual Renewal)'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Bank Verification & OCR Comparison (Officer / Approver / Admin Only) */}
      {activeTab === 'verification' && isOfficerOrAdmin && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Independent Bank Verification Scrutiny
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Side-by-side comparison between institution self-declaration and bank-reported record
                </p>
              </div>
              <div className="flex items-center gap-2">
                <VerificationTag
                  isBankVerified={Boolean(bankRecord?.is_verified || instrument.is_verified)}
                  verifiedAt={bankRecord?.verified_at ? formatDateIST(bankRecord.verified_at) : undefined}
                />
                {isOfficerOrAdmin && instrument.status === 'UNDER_SCRUTINY' && (
                  <Button
                    variant="outline"
                    size="sm"
                    isLoading={isVerifyingBank}
                    leftIcon={<RefreshCw className="w-4 h-4" />}
                    onClick={handleVerifyWithBank}
                  >
                    Query Bank Registry
                  </Button>
                )}
                {isOfficerOrAdmin && instrument.status === 'SUBMITTED' && (
                  <Button
                    variant="black"
                    size="sm"
                    isLoading={isStartingScrutiny}
                    leftIcon={<ShieldCheck className="w-4 h-4" />}
                    onClick={handleStartScrutiny}
                  >
                    Start Scrutiny
                  </Button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-700 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Attribute</th>
                    <th className="px-4 py-3 text-left">Self-Declared Value</th>
                    <th className="px-4 py-3 text-left">Bank Record Value</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {[
                    {
                      field: isBG ? 'Guarantee Number' : 'FDR / Account Number',
                      declared: instrument.fdr_number || instrument.reference_number,
                      bank: bankRecord?.bank_fdr_number || 'Pending response',
                      match: !bankRecord || (instrument.fdr_number || instrument.reference_number) === bankRecord?.bank_fdr_number,
                    },
                    {
                      field: isBG ? 'Guarantee Amount' : 'Principal Amount',
                      declared: formatINR(instrument.amount),
                      bank: bankRecord?.bank_amount ? formatINR(bankRecord.amount) : 'Pending response',
                      match: !bankRecord || Number(instrument.amount) === Number(bankRecord?.amount),
                    },
                    {
                      field: isBG ? 'Guarantee Expiry Date' : 'Maturity Date',
                      declared: formatDateIST(instrument.maturity_date),
                      bank: bankRecord?.bank_maturity_date ? formatDateIST(bankRecord.bank_maturity_date) : 'Pending response',
                      match: !bankRecord || instrument.maturity_date === bankRecord?.bank_maturity_date,
                    },
                    {
                      field: isBG ? 'Beneficiary' : 'Joint Holder AICTE',
                      declared: isBG ? (instrument.beneficiary_name || 'AICTE') : instrument.joint_holder_name,
                      bank: bankRecord?.bank_joint_holder || 'Pending response',
                      match: !bankRecord || Boolean(bankRecord?.joint_holder_match),
                    },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3.5 font-medium text-slate-900">{row.field}</td>
                      <td className="px-4 py-3.5">{row.declared}</td>
                      <td className="px-4 py-3.5 font-mono">{row.bank}</td>
                      <td className="px-4 py-3.5 text-center">
                        {!bankRecord ? (
                          <span className="text-xs text-slate-400">Awaiting Bank</span>
                        ) : row.match ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Match
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded">
                            <AlertTriangle className="w-3.5 h-3.5" /> Discrepancy
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI OCR Document Intelligence & Confidence Card */}
          <OcrComparisonCard
            instrument={instrument}
            documents={documents || []}
            onUploadClick={() => {
              if (missingDocCodes.length > 0) setUploadDocType(missingDocCodes[0]);
              setShowUploadModal(true);
            }}
          />

          {instrument.validation_flags && (
            <DocumentMismatchFlags
              flags={Array.isArray(instrument.validation_flags) ? instrument.validation_flags : [instrument.validation_flags]}
              instrumentId={id!}
            />
          )}
        </div>
      )}

      {/* AI Insights Tab (Phase 7C) */}
      {activeTab === 'ai_insights' && isOfficerOrAdmin && (
        <TrustInsightsCard instrumentId={id!} />
      )}

      {/* Tab 3: Documents Section */}
      {activeTab === 'documents' && (
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Encrypted Deposit Documents</h3>
              <p className="text-xs text-slate-500">Encrypted with AES-256-GCM in MinIO</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                if (missingDocCodes.length > 0) setUploadDocType(missingDocCodes[0]);
                setShowUploadModal(true);
              }}
            >
              Upload Document
            </Button>
          </div>

          {/* Missing Required Documents Banner */}
          {missingDocCodes.length > 0 && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-amber-900">Missing Required Documents: </span>
                  <span className="text-xs text-amber-800">
                    {missingDocCodes
                      .map((c) => registry?.document_types.find((d) => d.code === c)?.label || c)
                      .join(', ')}
                  </span>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setUploadDocType(missingDocCodes[0]);
                  setShowUploadModal(true);
                }}
              >
                Upload Missing
              </Button>
            </div>
          )}

          {/* Validation Flags (Attach Mode OCR) - Officer / Approver / Admin Only */}
          {isOfficerOrAdmin && instrument.validation_flags && (
            <DocumentMismatchFlags
              flags={Array.isArray(instrument.validation_flags) ? instrument.validation_flags : [instrument.validation_flags]}
              instrumentId={id!}
            />
          )}

          {documents && documents.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {documents.map((doc: any, index: number) => {
                const docDef = registry?.document_types.find(
                  (d) => d.code === (doc.doc_type || doc.document_type)
                );
                const docLabel = docDef?.label || doc.doc_type || doc.document_type || 'Document';

                return (
                  <div key={doc.id || index} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded text-slate-600">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-800">
                            {doc.filename || `${docLabel}_v${doc.version || 1}.pdf`}
                          </p>
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {docLabel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Version {doc.version || 1} • Uploaded {formatDateIST(doc.created_at, true)}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Download className="w-4 h-4" />}
                      onClick={() => handleDownloadDocument(doc.id, doc.filename || 'document.pdf')}
                    >
                      Decrypt & Download
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-6 text-center">No documents found for this instrument.</p>
          )}
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Upload Instrument Document</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Document Type *
                </label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  className="w-full py-2 px-3 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select Document Type...</option>
                  {(registry?.document_types || [])
                    .filter((d) => d.applicable_instruments.includes(instrument.instrument_type || 'FDR'))
                    .map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.label} {requiredDocTypes.includes(d.code) ? '(Mandatory)' : ''}
                      </option>
                    ))}
                </select>
              </div>

              <FileUpload
                selectedFile={uploadFile}
                onFileSelect={setUploadFile}
                label="Select Document File *"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUploadModal(false)}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isUploading}
                leftIcon={<Upload className="w-4 h-4" />}
                onClick={handleUploadDocument}
              >
                Upload & Attach
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Status History Timeline */}
      {activeTab === 'timeline' && (
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs">
          <h3 className="text-base font-bold text-slate-900 mb-6">FDR Lifecycle Transition Trail</h3>
          <Timeline items={timelineItems} />
        </div>
      )}

      {/* Tab 5: Renewal Lineage DAG */}
      {activeTab === 'lineage' && (
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-purple-600" />
            <h3 className="text-base font-bold text-slate-900">Renewal Chain Lineage</h3>
          </div>
          <p className="text-xs text-slate-500">
            Traces ancestors and successor instruments across multi-year renewals.
          </p>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm space-y-2">
            {lineage ? (
              <div>
                <p className="text-xs font-semibold text-slate-700">Lineage Chain:</p>
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  {lineage.ancestors?.map((anc: any, i: number) => (
                    <React.Fragment key={anc.id}>
                      <span
                        onClick={() => navigate(`/instruments/${anc.id}`)}
                        className="cursor-pointer px-2.5 py-1 bg-white border border-slate-300 rounded hover:border-primary text-xs"
                      >
                        {anc.fdr_number} ({formatDateIST(anc.issue_date)})
                      </span>
                      <span>→</span>
                    </React.Fragment>
                  ))}
                  <span className="px-2.5 py-1 bg-primary text-white font-bold rounded text-xs shadow-xs">
                    {instrument.fdr_number} (Current)
                  </span>
                  {lineage.descendants?.map((desc: any) => (
                    <React.Fragment key={desc.id}>
                      <span>→</span>
                      <span
                        onClick={() => navigate(`/instruments/${desc.id}`)}
                        className="cursor-pointer px-2.5 py-1 bg-white border border-slate-300 rounded hover:border-primary text-xs"
                      >
                        {desc.fdr_number} ({formatDateIST(desc.issue_date)})
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Original instrument (no prior renewals).</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Release / Refund Workflow */}
      {activeTab === 'release' && (
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Release & Refund Management</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Formal discharge of security deposit upon institutional closure or course cessation
              </p>
            </div>
            {latestReleaseRequest && (
              <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
                Request Status: {latestReleaseRequest.status}
              </span>
            )}
          </div>

          {instrument.status === 'RELEASED' ? (
            <div className="p-6 bg-slate-900 text-white rounded-lg space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                <div>
                  <h4 className="text-base font-bold">Deposit Discharged and Released</h4>
                  <p className="text-xs text-slate-300">
                    The security deposit has been officially closed by Approving Authority.
                  </p>
                </div>
              </div>

              {latestReleaseRequest?.id && (
                <div className="pt-2">
                  <Button
                    variant="saffron"
                    size="sm"
                    leftIcon={<Download className="w-4 h-4" />}
                    onClick={() => handleDownloadClosureLetter(latestReleaseRequest.id)}
                  >
                    Download Official Closure Letter PDF
                  </Button>
                </div>
              )}
            </div>
          ) : latestReleaseRequest ? (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-slate-500 block">Request Type</span>
                    <span className="font-semibold text-slate-800">{latestReleaseRequest.request_type}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Submitted On</span>
                    <span className="font-medium text-slate-800">
                      {formatDateIST(latestReleaseRequest.created_at, true)}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-slate-500 block">Reason for Release</span>
                    <span className="text-slate-700">{latestReleaseRequest.reason}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/release-requests/${latestReleaseRequest.id}`)}
                >
                  View Full Release Request & Conditions Progress
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-slate-600 mb-4">
                No active release request submitted for this instrument.
              </p>
              {['ACTIVE', 'EXPIRING', 'MATURED'].includes(instrument.status) && (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Send className="w-4 h-4" />}
                  onClick={() => navigate(`/instruments/${id}/release-request`)}
                >
                  Initiate Formal Release / Refund Request
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
