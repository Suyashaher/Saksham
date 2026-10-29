import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from './AuthContext';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface RequireRoleProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

export const RequireRole: React.FC<RequireRoleProps> = ({ allowedRoles, children }) => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Verifying authorization...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-[450px] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-red-200 rounded-lg p-6 shadow-sm text-center">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">403 — Access Forbidden</h2>
          <p className="text-sm text-slate-600 mb-4">
            Your assigned role (<span className="font-semibold text-slate-800">{user.role}</span>) does
            not hold clearance to view this administrative resource.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" size="sm" onClick={() => window.history.back()}>
              Go Back
            </Button>
            <Button variant="destructive" size="sm" onClick={logout}>
              Switch Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
