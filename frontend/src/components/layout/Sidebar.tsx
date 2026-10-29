import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  FileSpreadsheet,
  PlusCircle,
  Inbox,
  Search,
  CheckSquare,
  BellRing,
  BarChart3,
  Users,
  Building2,
  Sliders,
  FileCheck2,
  History,
  TrendingUp,
  PlayCircle,
  FileText,
  Sparkles,
  Box,
  Activity,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const role = user?.role;

  const getNavItems = (): { category?: string; items: NavItem[] }[] => {
    if (role === 'INSTITUTION') {
      return [
        {
          items: [
            { label: t('nav.dashboard', 'Overview'), path: '/overview', icon: LayoutDashboard },
            { label: t('nav.my_fdrs', 'My FDRs'), path: '/instruments', icon: FileSpreadsheet },
            { label: t('nav.submit_fdr', 'Submit New FDR'), path: '/instruments/new', icon: PlusCircle },
            { label: t('documents.deposit_confirmation', 'Account Statement'), path: '/statement', icon: FileText },
            { label: t('nav.alerts', 'Notifications'), path: '/notifications', icon: BellRing },
          ],
        },
      ];
    }

    if (role === 'VERIFYING_OFFICER') {
      return [
        {
          items: [
            { label: t('nav.work_queue', 'Scrutiny Queue'), path: '/officer/queue', icon: Inbox },
            { label: t('nav.dashboard', 'Officer Dashboard'), path: '/dashboard', icon: LayoutDashboard },
            { label: t('nav.fdr_search', 'Search Instruments'), path: '/officer/search', icon: Search },
            { label: t('nav.alerts', 'Alerts & Escalations'), path: '/alerts', icon: BellRing },
            { label: t('nav.reports', 'Reports & Export'), path: '/reports', icon: BarChart3 },
          ],
        },
      ];
    }

    if (role === 'APPROVING_AUTHORITY') {
      return [
        {
          items: [
            { label: t('nav.approvals', 'Approvals Inbox'), path: '/approvals', icon: CheckSquare },
            { label: t('nav.my_fdrs', 'Deposit Registry & Maturity Tracker'), path: '/instruments', icon: FileSpreadsheet },
            { label: t('nav.dashboard', 'System Dashboard'), path: '/dashboard', icon: LayoutDashboard },
            { label: t('nav.reports', 'Reports & Export'), path: '/reports', icon: BarChart3 },
            { label: t('nav.alerts', 'Alerts'), path: '/alerts', icon: BellRing },
          ],
        },
      ];
    }

    if (role === 'ADMIN') {
      return [
        {
          category: t('home.roles.section_badge', 'Operations'),
          items: [
            { label: t('nav.dashboard', 'Admin Dashboard'), path: '/admin', icon: LayoutDashboard },
            { label: t('nav.users', 'User Directory'), path: '/admin/users', icon: Users },
            { label: t('nav.institutions', 'Institutions'), path: '/admin/institutions', icon: Building2 },
          ],
        },
        {
          category: t('home.modules.section_badge', 'Policy & Workflow'),
          items: [
            { label: t('nav.alert_rules', 'Alert Rules'), path: '/admin/alert-rules', icon: Sliders },
            { label: t('nav.release_conditions', 'Release Conditions'), path: '/admin/release-conditions', icon: FileCheck2 },
          ],
        },
        {
          category: 'AI & Governance',
          items: [
            { label: 'Trust Weights', path: '/admin/ai/weights', icon: Sliders },
            { label: 'Model Registry', path: '/admin/ai/models', icon: Box },
            { label: 'AI Health', path: '/admin/ai/health', icon: Activity },
            { label: 'Feedback Logs', path: '/admin/ai/feedback', icon: MessageSquare },
          ],
        },
        {
          category: t('nav.audit_log', 'Governance & Audits'),
          items: [
            { label: t('nav.audit_log', 'Audit Trail'), path: '/admin/audit-log', icon: History },
            { label: t('nav.impact_metrics', 'Impact Metrics'), path: '/admin/impact-metrics', icon: TrendingUp },
            { label: t('nav.demo_runner', 'Demo Scan Runner'), path: '/admin/demo-runner', icon: PlayCircle },
          ],
        },
      ];
    }

    return [];
  };

  const navSections = getNavItems();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-900/50 md:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center px-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <img
              src="/saksham-logo.png"
              alt="Saksham Logo"
              className="w-10 h-10 object-contain rounded-full shadow-md bg-white p-0.5"
            />
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-wider text-white">SAKSHAM</span>
              <span className="text-[10px] text-slate-400 font-medium tracking-tight">AICTE Deposit Portal</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              {section.category && (
                <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  {section.category}
                </p>
              )}
              {section.items.map((item) => {
                const IconComponent = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary text-white shadow-xs'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                      }`
                    }
                  >
                    <IconComponent className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-400 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <span className="font-bold text-white">Saksham</span>
            <span>•</span>
            <span className="text-slate-400">AICTE Security Deposit</span>
          </div>
          <p className="text-slate-500 text-[10px] font-mono">SIH 2026 • PS 26265</p>
        </div>
      </aside>
    </>
  );
};
