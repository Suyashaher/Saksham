import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Info, Layers, LogIn, LayoutDashboard, Menu, X } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { useAuth } from '../../auth/AuthContext';
import { LanguageSelector } from '../../../components/ui/LanguageSelector';

export type NavModalType = 'about' | 'modules' | 'how-it-works' | 'contact' | 'accessibility';

interface HomeHeaderProps {
  onOpenModal: (type: NavModalType) => void;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({ onOpenModal }) => {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getDashboardPath = (): string => {
    if (!user) return '/login';
    switch (user.role) {
      case 'INSTITUTION':
        return '/overview';
      case 'VERIFYING_OFFICER':
        return '/officer/queue';
      case 'APPROVING_AUTHORITY':
        return '/approvals';
      case 'ADMIN':
        return '/admin/impact-metrics';
      default:
        return '/instruments';
    }
  };

  const handleLoginClick = () => {
    setMobileMenuOpen(false);
    if (isAuthenticated) {
      navigate(getDashboardPath());
    } else {
      navigate('/login');
    }
  };

  return (
    <header className="bg-[#0b192c] text-white border-b border-white/10 px-4 sm:px-6 lg:px-8 shrink-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between h-14 sm:h-16">
        {/* Left: BrandMark with white rounded card for logo */}
        <Link to="/" className="focus:outline-none focus:ring-2 focus:ring-blue-400 rounded-lg p-0.5">
          <BrandMark variant="dark-header" showSubtitle={true} />
        </Link>

        {/* Right: Navigation with small icons before each label */}
        <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-1.5 lg:gap-2">
          {/* Active: Home */}
          <Link
            to="/"
            className="bg-blue-600 text-white font-semibold rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-xs shadow-xs transition-colors"
            aria-current="page"
          >
            <Home className="w-3.5 h-3.5" />
            <span>{t('home.nav.home', 'Home')}</span>
          </Link>

          {/* About: opens About modal */}
          <button
            type="button"
            onClick={() => onOpenModal('about')}
            className="text-slate-300 hover:text-white hover:bg-white/10 rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" />
            <span>{t('home.nav.about', 'About')}</span>
          </button>

          {/* Modules: opens Modules modal */}
          <button
            type="button"
            onClick={() => onOpenModal('modules')}
            className="text-slate-300 hover:text-white hover:bg-white/10 rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t('home.nav.modules', 'Modules')}</span>
          </button>

          {/* Multilingual Selector */}
          <LanguageSelector variant="dark" />

          {/* Login / Dashboard */}
          <button
            type="button"
            onClick={handleLoginClick}
            className="text-slate-300 hover:text-white hover:bg-white/10 rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer"
          >
            {isAuthenticated ? (
              <>
                <LayoutDashboard className="w-3.5 h-3.5 text-accent-light" />
                <span>{t('home.nav.go_to_dashboard', 'Dashboard')}</span>
              </>
            ) : (
              <>
                <LogIn className="w-3.5 h-3.5" />
                <span>{t('home.nav.sign_in', 'Login')}</span>
              </>
            )}
          </button>
        </nav>

        {/* Mobile Hamburger & Language Selector */}
        <div className="flex items-center gap-2 md:hidden">
          <LanguageSelector variant="dark" showLabel={false} />
          <button
            type="button"
            onClick={handleLoginClick}
            className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg"
          >
            {isAuthenticated ? t('home.nav.go_to_dashboard', 'Dashboard') : t('home.nav.sign_in', 'Login')}
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/10 py-3 space-y-1 bg-[#0b192c]">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="w-full text-left px-3 py-2 text-xs font-bold bg-blue-600 text-white rounded-lg flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenModal('about');
            }}
            className="w-full text-left px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-lg flex items-center gap-2"
          >
            <Info className="w-4 h-4" />
            <span>About</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenModal('modules');
            }}
            className="w-full text-left px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-lg flex items-center gap-2"
          >
            <Layers className="w-4 h-4" />
            <span>Modules</span>
          </button>
        </div>
      )}
    </header>
  );
};
