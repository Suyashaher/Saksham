import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { SakshamChatbot } from '../../features/ai/chatbot/SakshamChatbot';

export const AppShell: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-800 relative">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50">
          <div className="max-w-7xl 2xl:max-w-[1536px] mx-auto">
            <Outlet />
          </div>
        </main>

        <footer className="bg-white border-t border-slate-200 px-6 py-3 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            © {new Date().getFullYear()} All India Council for Technical Education (AICTE). All
            Rights Reserved.
          </div>
          <div className="flex items-center gap-4 text-slate-400 text-[11px]">
            <span>Security Standard: AES-256-GCM</span>
            <span>•</span>
            <span>Audit: SHA-256 Hash Chained</span>
          </div>
        </footer>
      </div>

      {/* Floating Saksham AI Chatbot: Compliance & Explainable AI */}
      <SakshamChatbot />
    </div>
  );
};
