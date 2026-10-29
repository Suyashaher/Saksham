import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { formatApiError } from '../src/api/client';
import { ToastProvider, useToast } from '../src/components/ui/Toast';

describe('formatApiError helper', () => {
  it('returns simple string detail directly', () => {
    const err = { response: { data: { detail: 'Instrument not found' } } };
    expect(formatApiError(err)).toBe('Instrument not found');
  });

  it('safely formats FastAPI 422 array of validation error objects without crashing', () => {
    const err = {
      response: {
        data: {
          detail: [
            {
              type: 'uuid_parsing',
              loc: ['path', 'instrument_id'],
              msg: 'Input should be a valid UUID',
              input: 'undefined',
            },
            {
              type: 'missing',
              loc: ['body', 'maturity_date'],
              msg: 'Field required',
            },
          ],
        },
      },
    };
    const formatted = formatApiError(err);
    expect(typeof formatted).toBe('string');
    expect(formatted).toContain('instrument_id: Input should be a valid UUID');
    expect(formatted).toContain('maturity_date: Field required');
  });

  it('handles object detail and generic Axios errors gracefully', () => {
    const errObj = { response: { data: { detail: { message: 'Custom object error' } } } };
    expect(formatApiError(errObj)).toBe('Custom object error');

    const errNetwork = new Error('Network Error');
    expect(formatApiError(errNetwork)).toBe('Network Error');

    expect(formatApiError(null, 'Custom fallback')).toBe('Custom fallback');
  });
});

describe('ToastProvider error handling resilience', () => {
  const TestComponent: React.FC<{ triggerError: (toast: any) => void }> = ({ triggerError }) => {
    const toast = useToast();
    return (
      <button onClick={() => triggerError(toast)} data-testid="trigger-btn">
        Trigger Toast
      </button>
    );
  };

  it('safely renders without React child error when error message is an object or array', () => {
    const complexDetail = [
      {
        type: 'uuid_parsing',
        loc: ['path', 'instrument_id'],
        msg: 'Input should be a valid UUID',
        input: 'undefined',
        ctx: {},
      },
    ];

    render(
      <ToastProvider>
        <TestComponent
          triggerError={(toast) => {
            // Intentionally pass raw object array that previously crashed React
            toast.error('Submission Error', complexDetail);
          }}
        />
      </ToastProvider>
    );

    const button = screen.getByTestId('trigger-btn');
    act(() => {
      button.click();
    });

    expect(screen.getByText('Submission Error')).toBeInTheDocument();
    expect(screen.getByText(/Input should be a valid UUID/)).toBeInTheDocument();
  });
});
