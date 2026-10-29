import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../src/components/ui/Toast';
import { aiApi } from '../src/api/ai';
import { FilterChipGroup } from '../src/features/ai/nlsearch/FilterChipGroup';
import { ReasonList } from '../src/components/ui/ai/ReasonList';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {ui}
      </ToastProvider>
    </QueryClientProvider>
  );
};

describe('AI Invariants & Security Guardrails', () => {
  it('aiApi surface contains no mutating lifecycle transition endpoints', () => {
    // Assert that aiApi only exposes AI evaluation & governance endpoints
    const exposedMethods = Object.keys(aiApi);
    const forbiddenKeywords = ['transition', 'approve', 'reject', 'withdraw', 'release', 'lock'];

    exposedMethods.forEach((methodName) => {
      forbiddenKeywords.forEach((forbidden) => {
        expect(methodName.toLowerCase()).not.toContain(forbidden);
      });
    });
  });

  it('renders prompt injection and script injection strings as plain untrusted text', () => {
    const maliciousQuery = '<script>alert("xss")</script> DROP TABLE instruments; --';
    renderWithProviders(
      <FilterChipGroup
        chips={[maliciousQuery]}
        totalResults={0}
      />
    );

    // Verifies text is safely encoded in DOM and not executed as HTML
    const chipText = screen.getByText(maliciousQuery);
    expect(chipText).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });

  it('ReasonList safely renders untrusted explanation strings', () => {
    const rawReasons = [
      '<b>Bold injection</b>',
      '<img src=x onerror=alert(1)>',
      'Normal verified criteria',
    ];

    render(<ReasonList reasons={rawReasons} />);

    expect(screen.getByText('<b>Bold injection</b>')).toBeInTheDocument();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });
});
