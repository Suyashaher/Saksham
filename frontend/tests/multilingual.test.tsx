import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import i18n, { SUPPORTED_LANGUAGES } from '../src/i18n';
import { LanguageSelector } from '../src/components/ui/LanguageSelector';

describe('Multilingual i18n System', () => {
  beforeEach(async () => {
    // Reset language to English before each test
    await i18n.changeLanguage('en');
    localStorage.clear();
  });

  it('provides all 5 national e-Governance languages in configuration', () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(codes).toEqual(['en', 'hi', 'mr', 'ta', 'te']);
  });

  it('renders LanguageSelector dropdown and displays all language options', () => {
    render(<LanguageSelector variant="light" />);

    // Trigger button shows current language
    const trigger = screen.getByRole('button', { name: /select language/i });
    expect(trigger).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();

    // Open dropdown
    fireEvent.click(trigger);

    // All 5 languages must be selectable in the menu
    expect(screen.getByText('हिन्दी')).toBeInTheDocument();
    expect(screen.getByText('मराठी')).toBeInTheDocument();
    expect(screen.getByText('தமிழ்')).toBeInTheDocument();
    expect(screen.getByText('తెలుగు')).toBeInTheDocument();
  });

  it('switches language to Hindi (hi) and updates translation keys', async () => {
    render(<LanguageSelector variant="light" />);

    const trigger = screen.getByRole('button', { name: /select language/i });
    fireEvent.click(trigger);

    // Click Hindi option
    const hindiOption = screen.getByText('हिन्दी');
    fireEvent.click(hindiOption);

    await waitFor(() => {
      expect(i18n.language).toBe('hi');
    });

    // Check translated keys in Hindi
    expect(i18n.t('nav.dashboard')).toBe('डैशबोर्ड');
    expect(i18n.t('nav.my_fdrs')).toBe('मेरी सावधि जमा (FDRs)');
    expect(i18n.t('nav.submit_fdr')).toBe('नई सावधि जमा जमा करें');
    expect(i18n.t('status.VERIFIED')).toBe('बैंक द्वारा सत्यापित');
    expect(i18n.t('chatbot.title')).toBe('सक्षम एआई कोपायलट');

    // Check localStorage persistence
    expect(localStorage.getItem('saksham_language')).toBe('hi');
  });

  it('switches language to Marathi (mr) and updates translation keys', async () => {
    render(<LanguageSelector variant="light" />);

    const trigger = screen.getByRole('button', { name: /select language/i });
    fireEvent.click(trigger);

    // Click Marathi option
    const marathiOption = screen.getByText('मराठी');
    fireEvent.click(marathiOption);

    await waitFor(() => {
      expect(i18n.language).toBe('mr');
    });

    // Check translated keys in Marathi
    expect(i18n.t('nav.dashboard')).toBe('डॅशबोर्ड');
    expect(i18n.t('nav.my_fdrs')).toBe('माझ्या मुदत ठेवी (FDRs)');
    expect(i18n.t('status.VERIFIED')).toBe('बँक द्वारे सत्यापित');
    expect(i18n.t('chatbot.title')).toBe('सक्षम एआय कोपायलट');

    // Check localStorage persistence
    expect(localStorage.getItem('saksham_language')).toBe('mr');
  });

  it('switches language to Tamil (ta) and Telugu (te)', async () => {
    await i18n.changeLanguage('ta');
    expect(i18n.t('app.title')).toContain('சக்ஷம்');
    expect(i18n.t('nav.dashboard')).toBe('முகப்பு பலகை');

    await i18n.changeLanguage('te');
    expect(i18n.t('app.title')).toContain('సక్షమ్');
    expect(i18n.t('nav.dashboard')).toBe('డాష్‌బోర్డ్');
  });
});
