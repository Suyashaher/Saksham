import React, { useState } from 'react';
import { Bell, User, LogOut, Shield, Menu, Sparkles } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { AboutAiModal } from '../ui/ai/AboutAiModal';
import { LanguageSelector } from '../ui/LanguageSelector';
import { Link } from 'react-router-dom';

interface TopBarProps {
  onToggleSidebar?: () => void;
  unreadAlertsCount?: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  onToggleSidebar,
  unreadAlertsCount = 0,
}) => {
  const { user, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAboutAi, setShowAboutAi] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between z-20">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100 focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-3">
          <img
            src="/saksham-logo.png"
            alt="Saksham Logo"
            className="w-9 h-9 object-contain rounded-full shadow-xs border border-slate-200 bg-white"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold text-slate-900 tracking-tight">
                Saksham
              </span>
              <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                AICTE FDR Portal
              </span>
            </div>
            <span className="text-[11px] text-slate-500 hidden sm:block">
              AICTE Security Deposit & Bank Guarantee Management System
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Multilingual Selector */}
        <LanguageSelector variant="light" />

        {/* About AI modal trigger */}
        <button
          type="button"
          onClick={() => setShowAboutAi(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-400"
          title="About AI in this portal"
          aria-label="Learn about AI capabilities and data protection in this portal"
        >
          <Sparkles className="w-3.5 h-3.5 text-violet-600" />
          <span className="hidden sm:inline">About AI</span>
        </button>

        {/* Notifications / Alerts button */}
        <Link
          to={user?.role === 'INSTITUTION' ? '/notifications' : '/alerts'}
          className="relative p-2 text-slate-600 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="View notifications and alerts"
        >
          <Bell className="w-5 h-5" />
          {unreadAlertsCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
              {unreadAlertsCount > 9 ? '9+' : unreadAlertsCount}
            </span>
          )}
        </Link>

        {/* User profile dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            aria-expanded={showUserMenu}
            aria-label="User account menu"
          >
            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-semibold text-xs border border-slate-300">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold text-slate-800 leading-none">
                {user?.full_name || user?.email}
              </p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                {user?.role}
              </p>
            </div>
          </button>

          {showUserMenu && (
            <div
              className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-lg py-1.5 z-50 text-xs"
              role="menu"
            >
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="font-semibold text-slate-900 truncate">{user?.full_name}</p>
                <p className="text-slate-500 truncate">{user?.email}</p>
                <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded font-mono">
                  <Shield className="w-3 h-3" /> {user?.role}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  setShowLogoutConfirm(true);
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 text-left font-medium"
                role="menuitem"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title="Sign Out Confirmation"
        message="Are you sure you want to log out of the AICTE FDR Management Portal? Any unsaved form progress will be lost."
        confirmLabel="Sign Out"
        variant="danger"
        onConfirm={() => {
          setShowLogoutConfirm(false);
          logout();
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      <AboutAiModal
        isOpen={showAboutAi}
        onClose={() => setShowAboutAi(false)}
      />
    </header>
  );
};
