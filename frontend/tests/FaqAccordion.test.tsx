import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FaqAccordion } from '../src/features/home/components/FaqAccordion';
import { FAQS_DATA } from '../src/features/home/data/faqsData';

describe('FaqAccordion Component', () => {
  it('renders all questions from the editable data file', () => {
    render(<FaqAccordion />);

    FAQS_DATA.forEach((faq) => {
      expect(screen.getByText(faq.question)).toBeInTheDocument();
    });
  });

  it('supports accessible aria-expanded and toggles answer panel on click', () => {
    render(<FaqAccordion />);

    // First question button
    const firstFaq = FAQS_DATA[0];
    const button = screen.getByRole('button', { name: new RegExp(firstFaq.question, 'i') });

    // Initial state is open for the first item
    expect(button).toHaveAttribute('aria-expanded', 'true');

    // Click to collapse
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');

    // Click second question
    const secondFaq = FAQS_DATA[1];
    const secondButton = screen.getByRole('button', { name: new RegExp(secondFaq.question, 'i') });
    expect(secondButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(secondButton);
    expect(secondButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(secondFaq.answer)).toBeInTheDocument();
  });
});
