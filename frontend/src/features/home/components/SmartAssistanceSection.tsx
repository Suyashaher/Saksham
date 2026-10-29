import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Sliders, Clock, Search, FileEdit, MessageSquare, AlertTriangle, ShieldCheck } from 'lucide-react';

interface AiFeature {
  id: string;
  title: string;
  subtitle: string;
  modelType: string;
  description: string;
  icon: React.ElementType;
}

const AI_FEATURES: AiFeature[] = [
  {
    id: 'trust-score',
    title: 'Trust Score (0–100)',
    subtitle: 'Weighted Rule-Based Engine',
    modelType: 'v1.0-rule-based',
    description:
      'Calculates an objective 10-factor score across document completeness, OCR consistency, bank verification status, and date alignments to prioritize scrutiny queues.',
    icon: Sliders,
  },
  {
    id: 'turnaround-prediction',
    title: 'Turnaround Time Prediction',
    subtitle: 'Machine Learning (HistGradientBoosting)',
    modelType: 'v1-synthetic (Holdout MAE ~1.6d)',
    description:
      'Advisory regression models estimate expected scrutiny turnaround and release processing timelines to assist institutions with planning.',
    icon: Clock,
  },
  {
    id: 'document-autofill',
    title: 'Document OCR Auto-Fill',
    subtitle: 'Text Extraction & Entity Parsing',
    modelType: 'OCR v1.2',
    description:
      'Pre-extracts certificate numbers, financial amounts, tenure dates, and issuing branch IFSC codes to reduce repetitive typing errors.',
    icon: FileEdit,
  },
  {
    id: 'nl-search',
    title: 'Natural-Language Search',
    subtitle: 'Semantic Query Filtering',
    modelType: 'Rule & Keyword Parser',
    description:
      'Enables officers to search instruments intuitively (e.g. "show SBI deposits in Karnataka expiring within 60 days").',
    icon: Search,
  },
  {
    id: 'feedback-loop',
    title: 'Continuous Feedback Learning',
    subtitle: 'Active Learning Calibration',
    modelType: 'Supervised Tuning',
    description:
      'Captures officer feedback on score usefulness and prediction accuracy to tune rule weights systematically without black-box drift.',
    icon: MessageSquare,
  },
];

export const SmartAssistanceSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section
      id="smart-assistance"
      aria-label="Smart Assistance and AI Features"
      className="py-16 bg-slate-50 border-b border-slate-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <span className="inline-block text-xs font-bold uppercase tracking-wider text-primary bg-primary-100/70 px-3 py-1 rounded-full border border-primary-200 mb-3">
            {t('home.smart_ai.section_badge', 'Intelligent Oversight')}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t('home.smart_ai.section_title', 'Smart Assistance & Transparent AI')}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            {t(
              'home.smart_ai.section_subtitle',
              'Advisory intelligence designed to reduce clerical burdens while preserving human authority.'
            )}
          </p>
        </div>

        {/* Mandatory Ethical AI & Model Cards Transparency Banner */}
        <div className="mb-10 p-5 rounded-2xl bg-amber-50/80 border-2 border-amber-300 shadow-sm flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="p-3 bg-amber-100 text-amber-900 rounded-xl shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-700" />
          </div>
          <div className="text-left text-xs sm:text-sm text-amber-950 space-y-1">
            <p className="font-extrabold text-amber-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Human-in-the-Loop & Statutory Integrity Guarantee:</span>
            </p>
            <p className="leading-relaxed">
              AI models inside Saksham <strong>only prioritise, pre-fill, explain, and suggest</strong>. AI predictions CANNOT change priorities, bypass scrutiny queues, or trigger automatic approvals. <strong>AICTE Officers always make the final decision</strong>. All machine learning models in this prototype are trained on synthetic benchmark datasets in accordance with <code className="font-mono font-bold bg-amber-100 px-1 py-0.5 rounded">docs/MODEL_CARDS.md</code>.
            </p>
          </div>
        </div>

        {/* 5 AI Features Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {AI_FEATURES.map((feat) => {
            const IconComponent = feat.icon;
            return (
              <div
                key={feat.id}
                className="flex flex-col justify-between p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-primary-300 transition-all duration-150"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2.5 rounded-xl bg-primary-50 text-primary border border-primary-100">
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {feat.modelType}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-1">{feat.title}</h3>
                  <p className="text-xs font-semibold text-accent-dark mb-3">{feat.subtitle}</p>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {feat.description}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 text-slate-500">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>Advisory Only</span>
                  </span>
                  <span className="font-mono">Human Final Decision</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
