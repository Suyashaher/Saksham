import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, LogIn, LayoutDashboard, HelpCircle } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

interface SingleScreenHeroProps {
  onOpenHowItWorks: () => void;
}

export const SingleScreenHero: React.FC<SingleScreenHeroProps> = ({ onOpenHowItWorks }) => {
  const { t, i18n } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLoginClick = () => {
    if (isAuthenticated) {
      switch (user?.role) {
        case 'INSTITUTION':
          navigate('/overview');
          break;
        case 'VERIFYING_OFFICER':
          navigate('/officer/queue');
          break;
        case 'APPROVING_AUTHORITY':
          navigate('/approvals');
          break;
        case 'ADMIN':
          navigate('/admin/impact-metrics');
          break;
        default:
          navigate('/instruments');
      }
    } else {
      navigate('/login');
    }
  };

  // Multilingual headline support
  const getHeadlineLines = () => {
    switch (i18n.language) {
      case 'hi':
        return { line1: 'सुव्यवस्थित', line2: 'सुरक्षा जमा', line3: 'एवं सावधि जमा' };
      case 'mr':
        return { line1: 'सुलभीकृत', line2: 'सुरक्षा ठेवी', line3: 'आणि मुदत ठेवी' };
      case 'ta':
        return { line1: 'செம்மைப்படுத்தப்பட்ட', line2: 'பாதுகாப்பு வைப்பு', line3: '& நிலையான வைப்புகள்' };
      case 'te':
        return { line1: 'క్రమబద్ధీకరించిన', line2: 'సెక్యూరిటీ డిపాజిట్లు', line3: '& ఫిక్స్‌డ్ డిపాజిట్లు' };
      default:
        return { line1: 'Streamlining', line2: 'Security Deposits', line3: '& FDRs' };
    }
  };

  const { line1, line2, line3 } = getHeadlineLines();

  return (
    <div className="relative flex-1 flex flex-col justify-center w-full overflow-hidden bg-[#0b192c]">
      {/* 4. Right Side: Cinematic Hero Background Image with Gradient Mask Dissolving Left */}
      <div
        className="absolute inset-y-0 right-0 w-full md:w-3/5 lg:w-2/3 pointer-events-none overflow-hidden select-none"
        aria-hidden="true"
      >
        <picture className="w-full h-full block">
          <source
            type="image/webp"
            srcSet="/home/hero-bg-960.webp 960w, /home/hero-bg-1920.webp 1920w"
            sizes="(max-width: 960px) 960px, 1920px"
          />
          <img
            src="/home/hero-bg-1920.jpg"
            alt="Cinematic twilight view of a grand Indian technical education institute campus with ethereal digital security lines"
            fetchPriority="high"
            className="w-full h-full object-cover object-center md:object-right-bottom opacity-75 md:opacity-90 transition-opacity"
          />
        </picture>

        {/* Left dissolving gradient overlay: smoothly blends image into pure dark navy on the left */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b192c] via-[#0b192c]/90 md:via-[#0b192c]/75 to-transparent" />
        {/* Top/Bottom ambient fade */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b192c] via-transparent to-[#0b192c]/80" />
      </div>

      {/* 3. Left Column Text (Vertically Centered, Sitting on Clean Dark Surface) */}
      <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-3 sm:py-6 flex flex-col justify-center">
        <div className="max-w-2xl space-y-3 sm:space-y-4">
          {/* Overline Badge */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-900/60 border border-blue-400/30 text-blue-200 text-[11px] font-bold tracking-wide w-fit backdrop-blur-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>AICTE Security Deposit & FDR Management Portal</span>
          </div>

          {/* Three-Line Headline with Distinct Colors */}
          <h1 className="font-black tracking-tight leading-[1.06] text-left">
            <span className="block text-cyan-400 text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] xl:text-[3.6rem]">
              {line1}
            </span>
            <span className="block text-white text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] xl:text-[3.6rem]">
              {line2}
            </span>
            <span className="block text-blue-400 text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] xl:text-[3.6rem]">
              {line3}
            </span>
          </h1>

          {/* 3-4 Line Paragraph in Light Grey/White */}
          <p className="text-xs sm:text-sm md:text-base text-slate-300 font-normal leading-relaxed max-w-xl text-left">
            {t(
              'home.hero.purpose',
              'A unified digital platform for institutions and the Regulation Bureau to manage security deposits and FDRs, from submission and bank verification to maturity tracking, renewal and release. Transparent, secure and AI-assisted.'
            )}
          </p>

          {/* Two Buttons: Login & How It Works */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleLoginClick}
              className="bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-lg flex items-center gap-2 shadow-md hover:shadow-blue-500/20 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {isAuthenticated ? (
                <>
                  <LayoutDashboard className="w-4 h-4 text-accent-light" />
                  <span>{t('home.hero.cta_dashboard', 'Go to my dashboard')}</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>{t('home.hero.cta_signin', 'Login')}</span>
                </>
              )}
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onOpenHowItWorks}
              className="border border-white/80 hover:bg-white/10 active:scale-[0.98] text-white font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-white"
            >
              <HelpCircle className="w-4 h-4" />
              <span>{t('home.hero.cta_explore', 'How it works')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
