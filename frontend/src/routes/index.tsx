import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PublicLayout } from '../components/layout/PublicLayout';
import { AppShell } from '../components/layout/AppShell';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { RequireRole } from '../features/auth/RequireRole';
import { useAuth } from '../features/auth/AuthContext';

// Institution Features
import { InstitutionHome } from '../pages/InstitutionHome';
import { InstrumentList } from '../features/instruments/InstrumentList';
import { InstrumentDetail } from '../features/instruments/InstrumentDetail';
import { NewInstrumentWizard } from '../features/instruments/NewInstrumentWizard';
import { ReleaseRequestWizard } from '../features/releases/ReleaseRequestWizard';
import { ReleaseRequestDetail } from '../features/releases/ReleaseRequestDetail';
import { NotificationsPage } from '../pages/NotificationsPage';

// Officer Features
import { OfficerDashboard } from '../features/officer/OfficerDashboard';
import { OfficerQueue } from '../features/officer/OfficerQueue';
import { ScrutinyView } from '../features/officer/ScrutinyView';
import { FDRSearch } from '../features/officer/FDRSearch';
import { AlertsManagement } from '../features/officer/AlertsManagement';
import { ReportsPage } from '../features/reports/ReportsPage';

// Approver Features
import { ApprovalsInbox } from '../features/approvals/ApprovalsInbox';

// Admin Features
import { AdminUsers } from '../features/admin/AdminUsers';
import { AdminInstitutions } from '../features/admin/AdminInstitutions';
import { InstitutionAnalyticsView } from '../features/admin/InstitutionAnalyticsView';
import { AdminAlertRules } from '../features/admin/AdminAlertRules';
import { AdminReleaseConditions } from '../features/admin/AdminReleaseConditions';
import { AdminAuditLog } from '../features/admin/AdminAuditLog';
import { AdminImpactMetrics } from '../features/admin/AdminImpactMetrics';
import { AdminDemoRunner } from '../features/admin/AdminDemoRunner';

// Admin AI Consoles (Phase 7C)
import { TrustWeightsConsole } from '../features/ai/admin/TrustWeightsConsole';
import { ModelRegistryConsole } from '../features/ai/admin/ModelRegistryConsole';
import { AiHealthConsole } from '../features/ai/admin/AiHealthConsole';
import { FeedbackOverviewConsole } from '../features/ai/admin/FeedbackOverviewConsole';
import { PublicHomePage } from '../features/home/PublicHomePage';

// Smart Home Component redirecting based on active user role
export const RoleBasedHome: React.FC = () => {
  const { user } = useAuth();
  if (user?.role === 'VERIFYING_OFFICER') {
    return <Navigate to="/officer/queue" replace />;
  }
  if (user?.role === 'APPROVING_AUTHORITY') {
    return <Navigate to="/approvals" replace />;
  }
  if (user?.role === 'ADMIN') {
    return <Navigate to="/admin/impact-metrics" replace />;
  }
  return <Navigate to="/overview" replace />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Home Landing Page at "/" */}
      <Route path="/" element={<PublicHomePage />} />

      {/* Public Auth Routes */}
      <Route element={<PublicLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* Protected Routes inside AppShell */}
      <Route element={<AppShell />}>
        {/* Role-based dashboard redirector */}
        <Route
          path="/app"
          element={
            <RequireRole allowedRoles={['INSTITUTION', 'VERIFYING_OFFICER', 'APPROVING_AUTHORITY', 'ADMIN']}>
              <RoleBasedHome />
            </RequireRole>
          }
        />

        {/* Institution Overview */}
        <Route
          path="/overview"
          element={
            <RequireRole allowedRoles={['INSTITUTION']}>
              <InstitutionHome />
            </RequireRole>
          }
        />

        {/* FDR & Instrument Registry */}
        <Route
          path="/instruments"
          element={
            <RequireRole allowedRoles={['INSTITUTION', 'APPROVING_AUTHORITY', 'ADMIN', 'VERIFYING_OFFICER']}>
              <InstrumentList />
            </RequireRole>
          }
        />
        <Route
          path="/instruments/new"
          element={
            <RequireRole allowedRoles={['INSTITUTION']}>
              <NewInstrumentWizard />
            </RequireRole>
          }
        />
        <Route
          path="/instruments/:id"
          element={
            <RequireRole allowedRoles={['INSTITUTION', 'VERIFYING_OFFICER', 'APPROVING_AUTHORITY', 'ADMIN']}>
              <InstrumentDetail />
            </RequireRole>
          }
        />
        <Route
          path="/instruments/:id/release-request"
          element={
            <RequireRole allowedRoles={['INSTITUTION']}>
              <ReleaseRequestWizard />
            </RequireRole>
          }
        />
        <Route
          path="/release-requests/:requestId"
          element={
            <RequireRole allowedRoles={['INSTITUTION', 'VERIFYING_OFFICER', 'APPROVING_AUTHORITY', 'ADMIN']}>
              <ReleaseRequestDetail />
            </RequireRole>
          }
        />
        <Route
          path="/notifications"
          element={
            <RequireRole allowedRoles={['INSTITUTION', 'VERIFYING_OFFICER', 'APPROVING_AUTHORITY', 'ADMIN']}>
              <NotificationsPage />
            </RequireRole>
          }
        />
        <Route
          path="/statement"
          element={
            <RequireRole allowedRoles={['INSTITUTION']}>
              <ReportsPage />
            </RequireRole>
          }
        />

        {/* Officer & Executive Routes */}
        <Route
          path="/dashboard"
          element={
            <RequireRole allowedRoles={['VERIFYING_OFFICER', 'APPROVING_AUTHORITY', 'ADMIN']}>
              <OfficerDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/officer/queue"
          element={
            <RequireRole allowedRoles={['VERIFYING_OFFICER', 'APPROVING_AUTHORITY', 'ADMIN']}>
              <OfficerQueue />
            </RequireRole>
          }
        />
        <Route
          path="/officer/scrutiny/:id"
          element={
            <RequireRole allowedRoles={['VERIFYING_OFFICER', 'APPROVING_AUTHORITY', 'ADMIN']}>
              <ScrutinyView />
            </RequireRole>
          }
        />
        <Route
          path="/officer/search"
          element={
            <RequireRole allowedRoles={['VERIFYING_OFFICER', 'APPROVING_AUTHORITY', 'ADMIN']}>
              <FDRSearch />
            </RequireRole>
          }
        />
        <Route
          path="/alerts"
          element={
            <RequireRole allowedRoles={['VERIFYING_OFFICER', 'APPROVING_AUTHORITY', 'ADMIN']}>
              <AlertsManagement />
            </RequireRole>
          }
        />
        <Route
          path="/reports"
          element={
            <RequireRole allowedRoles={['VERIFYING_OFFICER', 'APPROVING_AUTHORITY', 'ADMIN']}>
              <ReportsPage />
            </RequireRole>
          }
        />

        {/* Approving Authority Routes */}
        <Route
          path="/approvals"
          element={
            <RequireRole allowedRoles={['APPROVING_AUTHORITY', 'ADMIN']}>
              <ApprovalsInbox />
            </RequireRole>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <RequireRole allowedRoles={['ADMIN']}>
              <Navigate to="/admin/impact-metrics" replace />
            </RequireRole>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireRole allowedRoles={['ADMIN']}>
              <AdminUsers />
            </RequireRole>
          }
        />
        <Route
          path="/admin/institutions"
          element={
            <RequireRole allowedRoles={['ADMIN']}>
              <AdminInstitutions />
            </RequireRole>
          }
        />
        <Route
          path="/admin/institutions/:id"
          element={
            <RequireRole allowedRoles={['ADMIN', 'VERIFYING_OFFICER', 'APPROVING_AUTHORITY']}>
              <InstitutionAnalyticsView />
            </RequireRole>
          }
        />
        <Route
          path="/admin/alert-rules"
          element={
            <RequireRole allowedRoles={['ADMIN']}>
              <AdminAlertRules />
            </RequireRole>
          }
        />
        <Route
          path="/admin/release-conditions"
          element={
            <RequireRole allowedRoles={['ADMIN']}>
              <AdminReleaseConditions />
            </RequireRole>
          }
        />
        <Route
          path="/admin/audit-log"
          element={
            <RequireRole allowedRoles={['ADMIN']}>
              <AdminAuditLog />
            </RequireRole>
          }
        />
        <Route
          path="/admin/impact-metrics"
          element={
            <RequireRole allowedRoles={['ADMIN']}>
              <AdminImpactMetrics />
            </RequireRole>
          }
        />
        <Route
          path="/admin/demo-runner"
          element={
            <RequireRole allowedRoles={['ADMIN']}>
              <AdminDemoRunner />
            </RequireRole>
          }
        />

        {/* Admin AI Routes (Phase 7C) */}
        <Route
          path="/admin/ai/weights"
          element={
            <RequireRole allowedRoles={['ADMIN']}>
              <TrustWeightsConsole />
            </RequireRole>
          }
        />
        <Route
          path="/admin/ai/models"
          element={
            <RequireRole allowedRoles={['ADMIN']}>
              <ModelRegistryConsole />
            </RequireRole>
          }
        />
        <Route
          path="/admin/ai/health"
          element={
            <RequireRole allowedRoles={['ADMIN']}>
              <AiHealthConsole />
            </RequireRole>
          }
        />
        <Route
          path="/admin/ai/feedback"
          element={
            <RequireRole allowedRoles={['ADMIN']}>
              <FeedbackOverviewConsole />
            </RequireRole>
          }
        />

        {/* Catch-all 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};
