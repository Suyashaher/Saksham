import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PredictionChip } from '../src/components/ui/ai/PredictionChip';

describe('PredictionChip Component', () => {
  it('renders point estimate and confidence interval range', () => {
    render(
      <PredictionChip
        predictedDays={4.2}
        intervalLow={2.5}
        intervalHigh={6.8}
        isHeuristic={false}
      />
    );
    expect(screen.getByText(/Est. ~4.2 days/)).toBeInTheDocument();
    expect(screen.getByText(/(2.5-6.8d)/)).toBeInTheDocument();
  });

  it('renders Estimate badge when prediction is heuristic fallback', () => {
    render(
      <PredictionChip
        predictedDays={7}
        isHeuristic={true}
      />
    );
    expect(screen.getByText('Estimate')).toBeInTheDocument();
  });

  it('renders At risk indicator when completion exceeds maturity date', () => {
    // Yesterday was maturity date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    render(
      <PredictionChip
        predictedDays={5}
        maturityDate={yesterday.toISOString()}
      />
    );
    expect(screen.getByText('At risk')).toBeInTheDocument();
  });

  it('returns null when predictedDays is null', () => {
    const { container } = render(<PredictionChip predictedDays={null} />);
    expect(container.firstChild).toBeNull();
  });
});
