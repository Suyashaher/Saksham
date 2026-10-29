import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ThumbsDown, ThumbsUp } from 'lucide-react';
import { aiApi } from '../../../api/ai';
import { queryKeys } from '../../../api/queryKeys';
import { formatApiError } from '../../../api/client';
import { useToast } from '../Toast';
import { useAiConfig } from './AiProvider';

export interface FeedbackButtonsProps {
  feature: 'ocr_autofill' | 'trust_score' | 'time_prediction' | 'nl_search' | 'cross_check' | 'letter_draft';
  entityId: string;
  outputRef?: Record<string, unknown> | null;
  modelVersion?: string;
  className?: string;
  label?: string;
  showDetails?: boolean;
}

export const FeedbackButtons: React.FC<FeedbackButtonsProps> = ({
  feature,
  entityId,
  outputRef = null,
  modelVersion = 'v1.0',
  className = '',
  label = 'Was this insight helpful?',
  showDetails = true,
}) => {
  const { isFeatureEnabled } = useAiConfig();
  const { success, error: toastError, info } = useToast();
  const queryClient = useQueryClient();

  const [submittedVerdict, setSubmittedVerdict] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async ({
      verdict,
      detail,
    }: {
      verdict: 'CORRECT' | 'INCORRECT';
      detail?: string;
    }) => {
      return aiApi.submitFeedback({
        ai_feature: feature,
        entity_id: entityId,
        ai_output: outputRef || undefined,
        officer_verdict: verdict,
        model_version: modelVersion,
        verdict_detail: detail || undefined,
      });
    },
    onSuccess: (data) => {
      setSubmittedVerdict(data.officer_verdict);
      success('Feedback Recorded', 'Thank you for helping train the portal models.');
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.feedbackStats() });
    },
    onError: (err: any) => {
      if (err.response?.status === 409) {
        info('Already Submitted', 'You have already provided feedback on this item.');
        setSubmittedVerdict('RECORDED');
      } else {
        toastError('Feedback Error', formatApiError(err, 'Could not record feedback.'));
      }
    },
  });

  if (!isFeatureEnabled('feedback')) {
    return null;
  }

  const handleVote = (verdict: 'CORRECT' | 'INCORRECT', detail?: string) => {
    setSelectedDetail(detail || null);
    mutation.mutate({ verdict, detail });
  };

  if (submittedVerdict) {
    return (
      <div className={`inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 ${className}`}>
        <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Feedback received</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 text-xs text-slate-600 ${className}`}>
      {label && <span className="select-none font-medium">{label}</span>}
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => handleVote('CORRECT')}
          disabled={mutation.isPending}
          className="p-1 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          title="Mark as correct / helpful"
          aria-label="Thumbs up - Mark insight as correct"
        >
          <ThumbsUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => handleVote('INCORRECT')}
          disabled={mutation.isPending}
          className="p-1 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-red-500"
          title="Mark as inaccurate / unhelpful"
          aria-label="Thumbs down - Mark insight as inaccurate"
        >
          <ThumbsDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {showDetails && (
        <div className="flex items-center gap-1 text-[11px]">
          {feature === 'trust_score' && (
            <>
              <button
                type="button"
                onClick={() => handleVote('INCORRECT', 'too_high')}
                disabled={mutation.isPending}
                className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50 transition-colors"
              >
                Too High
              </button>
              <button
                type="button"
                onClick={() => handleVote('INCORRECT', 'too_low')}
                disabled={mutation.isPending}
                className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50 transition-colors"
              >
                Too Low
              </button>
            </>
          )}

          {feature === 'time_prediction' && (
            <>
              <button
                type="button"
                onClick={() => handleVote('INCORRECT', 'too_optimistic')}
                disabled={mutation.isPending}
                className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50 transition-colors"
              >
                Too Optimistic
              </button>
              <button
                type="button"
                onClick={() => handleVote('INCORRECT', 'too_pessimistic')}
                disabled={mutation.isPending}
                className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50 transition-colors"
              >
                Too Pessimistic
              </button>
            </>
          )}

          {(feature === 'cross_check' || feature === 'ocr_autofill') && (
            <>
              <button
                type="button"
                onClick={() => handleVote('INCORRECT', 'false_alarm')}
                disabled={mutation.isPending}
                className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50 transition-colors"
              >
                False Alarm
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
