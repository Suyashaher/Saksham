import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UtilityBar, FontScale } from '../src/features/home/components/UtilityBar';

describe('UtilityBar Component', () => {
  it('renders skip to main content link and GoI masthead', () => {
    render(
      <UtilityBar
        fontScale="md"
        setFontScale={vi.fn()}
        isHighContrast={false}
        setIsHighContrast={vi.fn()}
      />
    );

    const skipLink = screen.getByText(/skip to main content/i);
    expect(skipLink).toHaveAttribute('href', '#main-content');
    expect(screen.getByText('भारत सरकार')).toBeInTheDocument();
  });

  it('triggers font scale changes when A- / A / A+ are clicked', () => {
    const setFontScaleMock = vi.fn();
    render(
      <UtilityBar
        fontScale="md"
        setFontScale={setFontScaleMock}
        isHighContrast={false}
        setIsHighContrast={vi.fn()}
      />
    );

    const decreaseBtn = screen.getByRole('button', { name: /decrease font size/i });
    fireEvent.click(decreaseBtn);
    expect(setFontScaleMock).toHaveBeenCalledWith('sm');

    const increaseBtn = screen.getByRole('button', { name: /increase font size/i });
    fireEvent.click(increaseBtn);
    expect(setFontScaleMock).toHaveBeenCalledWith('lg');
  });

  it('toggles high contrast mode when the button is clicked', () => {
    const setContrastMock = vi.fn();
    render(
      <UtilityBar
        fontScale="md"
        setFontScale={vi.fn()}
        isHighContrast={false}
        setIsHighContrast={setContrastMock}
      />
    );

    const contrastBtn = screen.getByRole('button', { name: /high contrast/i });
    fireEvent.click(contrastBtn);
    expect(setContrastMock).toHaveBeenCalled();
  });
});
