import React, { useState } from 'react';
import { HomeHeader, NavModalType } from './components/HomeHeader';
import { SingleScreenHero } from './components/SingleScreenHero';
import { SakshamChatbot } from '../ai/chatbot/SakshamChatbot';

// Lightweight Modals keeping main page zero-scroll
import { AboutModal } from './components/modals/AboutModal';
import { ModulesModal } from './components/modals/ModulesModal';
import { HowItWorksModal } from './components/modals/HowItWorksModal';
import { ContactModal } from './components/modals/ContactModal';
import { AccessibilityModal } from './components/modals/AccessibilityModal';

export const PublicHomePage: React.FC = () => {
  // Active modal state for zero-scroll navigation
  const [activeModal, setActiveModal] = useState<NavModalType | null>(null);

  return (
    <div className="w-full min-h-screen md:h-screen md:max-h-screen md:overflow-hidden flex flex-col font-sans select-none selection:bg-blue-600 selection:text-white bg-[#0b192c] text-white">
      {/* Hidden Skip Link for Screen Readers and Keyboard Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:font-bold focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>

      {/* 1. Dark Navy Top Bar (Header) */}
      <HomeHeader onOpenModal={(modal) => setActiveModal(modal)} />

      {/* 2. Full-Bleed Hero Area (Takes Most of Viewport Height) */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 flex flex-col justify-center overflow-hidden focus:outline-none relative"
      >
        <SingleScreenHero onOpenHowItWorks={() => setActiveModal('how-it-works')} />
      </main>

      {/* Modals: Accessible & Zero-Scroll */}
      <AboutModal
        isOpen={activeModal === 'about'}
        onClose={() => setActiveModal(null)}
      />
      <ModulesModal
        isOpen={activeModal === 'modules'}
        onClose={() => setActiveModal(null)}
      />
      <HowItWorksModal
        isOpen={activeModal === 'how-it-works'}
        onClose={() => setActiveModal(null)}
      />
      <ContactModal
        isOpen={activeModal === 'contact'}
        onClose={() => setActiveModal(null)}
      />
      <AccessibilityModal
        isOpen={activeModal === 'accessibility'}
        onClose={() => setActiveModal(null)}
      />

      {/* 3. Floating AI Assistant (Institutional Compliance & Explainable AI) */}
      <SakshamChatbot />
    </div>
  );
};
