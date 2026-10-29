import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './features/auth/AuthContext';
import { AiProvider } from './components/ui/ai/AiProvider';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { AppRoutes } from './routes';
import './i18n';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        // Do not retry 401 or 403 or 404
        if ([401, 403, 404].includes(error?.response?.status)) {
          return false;
        }
        return failureCount < 2;
      },
      staleTime: 1000 * 30, // 30 seconds
    },
  },
});

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <AiProvider>
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </AiProvider>
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
