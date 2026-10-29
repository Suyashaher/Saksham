import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  Bot,
  User,
  Send,
  X,
  Maximize2,
  Minimize2,
  RefreshCw,
  Building2,
  Brain,
  ShieldCheck,
  Check,
  Copy,
  ExternalLink,
  Lock,
  LogIn,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import {
  ChatbotMode,
  ChatMessage,
  PRESET_PROMPTS,
  INITIAL_GREETINGS,
  generateChatbotReply,
} from './chatbotKnowledge';

interface SakshamChatbotProps {
  initialOpen?: boolean;
  defaultMode?: ChatbotMode;
}

export const SakshamChatbot: React.FC<SakshamChatbotProps> = ({
  initialOpen = false,
  defaultMode = 'compliance',
}) => {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();

  // Role permissions
  // 1. Compliance Intelligence: available for everyone who is logged in
  const isComplianceAllowed = isAuthenticated;

  // 2. Explainable AI: strictly available for Verifying Officer, Approving Authority, and Admin
  const isExplainableAllowed =
    isAuthenticated &&
    (user?.role === 'VERIFYING_OFFICER' ||
      user?.role === 'APPROVING_AUTHORITY' ||
      user?.role === 'ADMIN');

  const [isOpen, setIsOpen] = useState(initialOpen);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeMode, setActiveMode] = useState<ChatbotMode>(defaultMode);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_GREETINGS[defaultMode]]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom of messages container
  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isTyping, activeMode]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, activeMode]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Switch mode handler
  const handleModeChange = (mode: ChatbotMode) => {
    if (mode === activeMode) return;
    setActiveMode(mode);
    const greeting = INITIAL_GREETINGS[mode];
    setMessages((prev) => [
      ...prev,
      {
        ...greeting,
        id: `switch-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Reset chat
  const handleReset = () => {
    setMessages([INITIAL_GREETINGS[activeMode]]);
    setInputText('');
  };

  // Submit query
  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend ?? inputText).trim();
    if (!query || isTyping) return;

    // Check if user is trying to ask Explainable AI while unauthorized
    if (activeMode === 'explainable' && !isExplainableAllowed) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      mode: activeMode,
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    // Realistic AI delay
    setTimeout(() => {
      const reply = generateChatbotReply(query, activeMode);
      setMessages((prev) => [...prev, reply]);
      setIsTyping(false);
    }, 450);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <>
      {/* 1. Floating Launcher Pill Button (Bottom Right) */}
      {!isOpen && (
        <aside
          aria-label="AI Assistant Quick Launch"
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 group"
        >
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2.5 bg-[#0b192c] hover:bg-[#122644] active:scale-95 text-white px-4 py-2.5 rounded-full shadow-xl border border-blue-400/30 hover:border-blue-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
            aria-label="Open Saksham AI Copilot Assistant"
          >
            <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 text-white shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="text-xs font-bold tracking-tight text-white">Saksham Copilot</span>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  AI
                </span>
              </div>
              <span className="text-[10px] text-slate-300 mt-0.5 leading-none">
                Compliance & Explainable AI
              </span>
            </div>
          </button>
        </aside>
      )}

      {/* 2. Chatbot Dialog Drawer / Floating Window */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Saksham AI Assistant Chatbot"
          className={`fixed z-50 transition-all duration-200 flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-300 overflow-hidden ${
            isExpanded
              ? 'inset-4 md:inset-10 max-w-5xl mx-auto'
              : 'bottom-4 right-4 w-[94vw] sm:w-[460px] h-[640px] max-h-[88vh]'
          }`}
        >
          {/* Header */}
          <header className="bg-[#0b192c] text-white px-4 py-3 shrink-0 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center text-white shadow-xs">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                    {t('chatbot.title', 'Saksham AI Copilot')}
                  </h2>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    {t('chatbot.model_version', 'Model v2.4')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-300 leading-tight">
                  <span>Role: {isAuthenticated ? user?.role : t('chatbot.role_guest', 'Guest')}</span>
                  <span>•</span>
                  <span>{isAuthenticated ? user?.full_name : t('chatbot.not_logged_in', 'Not Logged In')}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-300">
              <button
                type="button"
                onClick={handleReset}
                title="Reset conversation"
                className="p-1.5 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                aria-label="Reset conversation"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Collapse' : 'Expand'}
                className="p-1.5 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer hidden sm:block"
                aria-label={isExpanded ? 'Collapse window' : 'Expand window'}
              >
                {isExpanded ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close chatbot"
                className="p-1.5 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                aria-label="Close chatbot"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Mode Selector Segmented Tabs with Role Badges */}
          <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 shrink-0">
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/80 rounded-xl text-xs font-semibold">
              {/* Tab 1: Compliance Intelligence (Available for everyone logged in) */}
              <button
                type="button"
                onClick={() => handleModeChange('compliance')}
                className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                  activeMode === 'compliance'
                    ? 'bg-white text-blue-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  <span className="truncate">{t('chatbot.compliance_tab', '4. Compliance')}</span>
                </div>
                <span className="text-[9px] font-normal text-slate-500 mt-0.5">
                  {isComplianceAllowed ? t('chatbot.logged_in_access', '✓ Logged-in Access') : t('chatbot.login_for_records', '🔒 Login for Records')}
                </span>
              </button>

              {/* Tab 2: Explainable AI (Strictly Verifying Officers & Approvers) */}
              <button
                type="button"
                onClick={() => handleModeChange('explainable')}
                className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                  activeMode === 'explainable'
                    ? 'bg-white text-blue-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {isExplainableAllowed ? (
                    <Brain className="w-3.5 h-3.5 text-cyan-600" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                  )}
                  <span className="truncate">{t('chatbot.explainable_tab', '5. Explainable AI')}</span>
                </div>
                <span className="text-[9px] font-normal text-slate-500 mt-0.5">
                  {isExplainableAllowed ? t('chatbot.officer_access', '✓ Officer & Approver') : t('chatbot.officers_only', '🔒 Officers Only')}
                </span>
              </button>
            </div>
          </div>

          {/* Role Status Bar & Advisory Banners */}
          {!isAuthenticated && activeMode === 'compliance' && (
            <div className="bg-blue-50 border-b border-blue-200 px-3 py-1.5 text-[11px] text-blue-900 flex items-center justify-between shrink-0">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Log in to access your institution's specific compliance audit.</span>
              </span>
              <Link
                to="/login"
                onClick={() => setIsOpen(false)}
                className="font-bold underline text-blue-700 hover:text-blue-900 shrink-0"
              >
                Login →
              </Link>
            </div>
          )}

          {/* If Mode is Explainable AI and user is NOT allowed, show clean Role-Gate */}
          {activeMode === 'explainable' && !isExplainableAllowed ? (
            <div className="flex-1 p-6 flex flex-col items-center justify-center text-center bg-slate-50/70">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center mb-3 shadow-xs">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Explainable AI Restricted to Verifying Officers & Approvers
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed max-w-sm mt-2">
                Under AICTE Phase 7 Governance Invariants, internal model parameter decomposition (10-factor Trust Score weights, officer anomaly scrutiny diagnostics, and turnaround predictors) is reserved exclusively for regulatory <strong>Verifying Officers</strong> and <strong>Approving Authorities</strong>.
              </p>

              <div className="mt-4 p-3 bg-white rounded-xl border border-slate-200 text-left text-xs text-slate-700 max-w-sm w-full space-y-1.5 shadow-2xs">
                <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                  Access Permissions:
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span>Institution Users:</span>
                  <span className="font-semibold text-blue-700">Compliance Intelligence ✓</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span>Verifying Officers:</span>
                  <span className="font-semibold text-emerald-700">Full Explainable AI ✓</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span>Approving Authority:</span>
                  <span className="font-semibold text-emerald-700">Full Explainable AI ✓</span>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveMode('compliance')}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  Switch to Compliance Intelligence
                </button>
                {!isAuthenticated && (
                  <Link
                    to="/login"
                    onClick={() => setIsOpen(false)}
                    className="border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Officer Login</span>
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Messages Scroll Area */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-slate-50/60 text-xs">
                {messages.map((msg) => {
                  const isAssistant = msg.sender === 'assistant';
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2.5 ${isAssistant ? '' : 'flex-row-reverse'}`}
                    >
                      {/* Avatar */}
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-2xs ${
                          isAssistant
                            ? 'bg-[#0b192c] text-cyan-400'
                            : 'bg-blue-600 text-white'
                        }`}
                      >
                        {isAssistant ? <Sparkles className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                      </div>

                      {/* Message Bubble */}
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 space-y-2 relative group ${
                          isAssistant
                            ? 'bg-white text-slate-800 border border-slate-200/80 shadow-xs rounded-tl-sm'
                            : 'bg-blue-600 text-white rounded-tr-sm'
                        }`}
                      >
                        {/* Assistant Metadata Badge */}
                        {isAssistant && msg.metadata?.badge && (
                          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                msg.metadata.badge.variant === 'success'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : msg.metadata.badge.variant === 'warning'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : msg.metadata.badge.variant === 'danger'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {msg.metadata.badge.text}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(msg.text, msg.id)}
                              className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
                              title="Copy response"
                            >
                              {copiedId === msg.id ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        )}

                        {/* Text Body with basic markdown formatting */}
                        <div className="leading-relaxed whitespace-pre-wrap font-sans text-xs">
                          {msg.text}
                        </div>

                        {/* Metrics Grid if available */}
                        {isAssistant && msg.metadata?.metrics && (
                          <div className="grid grid-cols-2 gap-1.5 pt-1.5">
                            {msg.metadata.metrics.map((m, idx) => (
                              <div
                                key={idx}
                                className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-center"
                              >
                                <div className="text-[10px] text-slate-500 font-medium">{m.label}</div>
                                <div className="text-xs font-bold text-slate-900">{m.value}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Factor Breakdown Table if available (Explainable AI) */}
                        {isAssistant && msg.metadata?.factorBreakdown && (
                          <div className="pt-2">
                            <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                              Factor Weight Decomposition:
                            </div>
                            <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50">
                              <table className="w-full text-[10px] text-left">
                                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                                  <tr>
                                    <th className="p-1.5">Factor</th>
                                    <th className="p-1.5 text-right">Weight</th>
                                    <th className="p-1.5 text-right">Contrib</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200/60">
                                  {msg.metadata.factorBreakdown.map((row, fIdx) => (
                                    <tr key={fIdx}>
                                      <td className="p-1.5 text-slate-800">{row.factor}</td>
                                      <td className="p-1.5 text-right font-mono text-slate-500">{row.weight}</td>
                                      <td
                                        className={`p-1.5 text-right font-bold ${
                                          row.status === 'positive'
                                            ? 'text-emerald-600'
                                            : row.status === 'warning'
                                            ? 'text-amber-600'
                                            : 'text-slate-600'
                                        }`}
                                      >
                                        {row.contribution}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Action Links */}
                        {isAssistant && msg.metadata?.links && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {msg.metadata.links.map((link, lIdx) => (
                              <Link
                                key={lIdx}
                                to={link.href}
                                onClick={() => setIsOpen(false)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200 transition-colors"
                              >
                                <span>{link.label}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </Link>
                            ))}
                          </div>
                        )}

                        {/* Timestamp */}
                        <div
                          className={`text-[9px] mt-1 text-right ${
                            isAssistant ? 'text-slate-400' : 'text-blue-100'
                          }`}
                        >
                          {msg.timestamp}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Typing Indicator */}
                {isTyping && (
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#0b192c] text-cyan-400 flex items-center justify-center shrink-0 shadow-2xs">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-xs flex items-center gap-1.5 text-slate-500 text-xs">
                      <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" />
                      <span
                        className="w-2 h-2 rounded-full bg-blue-600 animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="w-2 h-2 rounded-full bg-blue-600 animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                      <span className="ml-1 text-[11px] font-medium text-slate-500">
                        {activeMode === 'compliance'
                          ? 'Analyzing institutional deposit records...'
                          : 'Decomposing mathematical factor weights...'}
                      </span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Preset Prompts Carousel (12 Questions per Mode) */}
              <div className="bg-white border-t border-slate-100 px-3 py-2 shrink-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-600" />
                    <span>
                      {activeMode === 'compliance' ? '12 Compliance Presets' : '12 Explainable AI Presets'}:
                    </span>
                  </span>
                  <span className="text-[9px] font-normal text-slate-400">Scroll horizontally →</span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                  {PRESET_PROMPTS[activeMode].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSendMessage(preset.query)}
                      className="whitespace-nowrap bg-slate-50 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border border-slate-200 text-slate-700 text-[11px] px-2.5 py-1 rounded-full transition-colors shrink-0 cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    activeMode === 'compliance'
                      ? t('chatbot.ask_placeholder_compliance', 'Ask about DTU, COEP, shortfall, replacement FDR, norms...')
                      : t('chatbot.ask_placeholder_explainable', 'Ask about Trust Score 72, suspect doc type, fast-track, turnaround...')
                  }
                  className="flex-1 text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isTyping}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white p-2 rounded-xl shadow-xs transition-colors cursor-pointer"
                  aria-label={t('chatbot.send', 'Send message')}
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          )}

          {/* Footer Disclaimer */}
          <footer className="bg-slate-100 border-t border-slate-200 px-3 py-1.5 text-[9px] text-slate-500 flex items-center justify-between shrink-0">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-blue-600" />
              <span>{t('chatbot.disclaimer', 'Advisory AI only • Final authority remains with AICTE Regulatory Officers')}</span>
            </span>
            <span className="font-mono text-slate-400">SIH PS 26265</span>
          </footer>
        </div>
      )}
    </>
  );
};
