import { apiClient } from './client';
import type { components, paths } from './v1';

export type AiConfigResponse = {
  ai_enabled: boolean;
  features: {
    ocr: { enabled: boolean; data_source: string };
    trust_score: { enabled: boolean; data_source: string };
    prediction: { enabled: boolean; data_source: string };
    nl_search: { enabled: boolean; data_source: string };
    feedback: { enabled: boolean; data_source: string };
  };
};

export type TrustScoreResponse = components['schemas']['TrustScoreResponse'];
export type FactorResponse = components['schemas']['FactorResponse'];
export type PredictionResponse = components['schemas']['PredictionResponse'];
export type PredictionTargetResponse = components['schemas']['PredictionTargetResponse'];
export type NLSearchRequest = components['schemas']['NLSearchRequest'];
export type NLSearchResponse = components['schemas']['NLSearchResponse'];
export type NLSearchResultItem = components['schemas']['NLSearchResultItem'];
export type FeedbackSubmitRequest = components['schemas']['FeedbackSubmitRequest'];
export type FeedbackSubmitResponse = components['schemas']['FeedbackSubmitResponse'];
export type RewardMetric = components['schemas']['RewardMetric'];
export type WeightResponse = components['schemas']['WeightResponse'];
export type AIModelResponse = components['schemas']['AIModelResponse'];
export type OcrPreviewResponse = components['schemas']['OcrPreviewResponse'];
export type OcrAttachResponse = components['schemas']['OcrAttachResponse'];
export type OcrFieldResponse = components['schemas']['OcrFieldResponse'];

export interface OcrRunRecord {
  id: string;
  document_id: string;
  instrument_id: string;
  doc_type: string;
  engine: string;
  engine_version: string | null;
  duration_ms: number;
  page_count: number;
  overall_confidence: number;
  per_field_confidence: Record<string, number>;
  mismatch_count: number;
  created_at: string;
}

export const aiApi = {
  getConfig: async (): Promise<AiConfigResponse> => {
    const res = await apiClient.get<AiConfigResponse>('/api/v1/ai/config');
    return res.data;
  },

  getTrustScore: async (instrumentId: string, recompute = false): Promise<TrustScoreResponse> => {
    const res = await apiClient.get<TrustScoreResponse>(
      `/api/v1/instruments/${instrumentId}/trust-score`,
      { params: { recompute } }
    );
    return res.data;
  },

  getPredictedTime: async (instrumentId: string): Promise<PredictionResponse> => {
    const res = await apiClient.get<PredictionResponse>(
      `/api/v1/instruments/${instrumentId}/predicted-time`
    );
    return res.data;
  },

  nlSearch: async (request: NLSearchRequest): Promise<NLSearchResponse> => {
    const res = await apiClient.post<NLSearchResponse>('/api/v1/instruments/nl-search', request);
    return res.data;
  },

  submitFeedback: async (request: FeedbackSubmitRequest): Promise<FeedbackSubmitResponse> => {
    const res = await apiClient.post<FeedbackSubmitResponse>('/api/v1/ai/feedback', request);
    return res.data;
  },

  getFeedbackStats: async (windowDays = 30): Promise<RewardMetric[]> => {
    const res = await apiClient.get<RewardMetric[]>('/api/v1/ai/feedback/stats', {
      params: { window_days: windowDays },
    });
    return res.data;
  },

  getWeights: async (): Promise<WeightResponse[]> => {
    const res = await apiClient.get<WeightResponse[]>('/api/v1/ai/weights');
    return res.data;
  },

  updateWeights: async (weights: Record<string, number>): Promise<{ status: string; version: number }> => {
    const res = await apiClient.put<{ status: string; version: number }>('/api/v1/ai/weights', weights);
    return res.data;
  },

  getModels: async (): Promise<AIModelResponse[]> => {
    const res = await apiClient.get<AIModelResponse[]>('/api/v1/ai/models');
    return res.data;
  },

  promoteModel: async (modelId: string): Promise<{ status: string; message: string }> => {
    const res = await apiClient.post<{ status: string; message: string }>(
      `/api/v1/ai/models/${modelId}/promote`
    );
    return res.data;
  },

  ocrPreview: async (file: File, docType = 'FDR_SCAN'): Promise<OcrPreviewResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('doc_type', docType);

    const res = await apiClient.post<OcrPreviewResponse>('/api/v1/ai/ocr/preview', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  ocrExtractDocument: async (documentId: string): Promise<OcrAttachResponse> => {
    const res = await apiClient.post<OcrAttachResponse>(
      `/api/v1/ai/ocr/extract/${documentId}`
    );
    return res.data;
  },

  getOcrRuns: async (instrumentId: string): Promise<OcrRunRecord[]> => {
    const res = await apiClient.get<OcrRunRecord[]>(`/api/v1/ai/ocr/runs/${instrumentId}`);
    return res.data;
  },
};
