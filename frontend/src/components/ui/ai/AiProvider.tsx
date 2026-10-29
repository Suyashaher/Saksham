import React, { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { aiApi, AiConfigResponse } from '../../../api/ai';
import { queryKeys } from '../../../api/queryKeys';

export type AIFeatureKey = 'ocr' | 'trust_score' | 'prediction' | 'nl_search' | 'feedback';

interface AiContextValue {
  isAiGlobalEnabled: boolean;
  isFeatureEnabled: (feature: AIFeatureKey) => boolean;
  getDataSource: (feature: AIFeatureKey) => string;
  config?: AiConfigResponse;
  isLoading: boolean;
  isError: boolean;
}

const AiContext = createContext<AiContextValue>({
  isAiGlobalEnabled: false,
  isFeatureEnabled: () => false,
  getDataSource: () => 'n/a',
  isLoading: false,
  isError: false,
});

export const AiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isViteAiEnabled = import.meta.env.VITE_FEATURE_AI === 'true';

  const { data: config, isLoading, isError } = useQuery({
    queryKey: queryKeys.ai.config,
    queryFn: aiApi.getConfig,
    enabled: isViteAiEnabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const isAiGlobalEnabled = isViteAiEnabled && !!config?.ai_enabled;

  const isFeatureEnabled = (feature: AIFeatureKey): boolean => {
    if (!isAiGlobalEnabled || !config?.features) return false;
    const feat = config.features[feature];
    return !!feat?.enabled;
  };

  const getDataSource = (feature: AIFeatureKey): string => {
    if (!config?.features) return 'n/a';
    return config.features[feature]?.data_source || 'n/a';
  };

  return (
    <AiContext.Provider
      value={{
        isAiGlobalEnabled,
        isFeatureEnabled,
        getDataSource,
        config,
        isLoading,
        isError,
      }}
    >
      {children}
    </AiContext.Provider>
  );
};

export const useAiConfig = () => useContext(AiContext);
