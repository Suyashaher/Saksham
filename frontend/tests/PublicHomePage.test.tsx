import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicHomePage } from '../src/features/home/PublicHomePage';
import * as AuthContextModule from '../src/features/auth/AuthContext';
import { apiClient } from '../src/api/client';

describe('PublicHomePage Component (Single-Screen Government Portal)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all semantic landmarks and accessible skip link with zero API calls', () => {
    const apiSpy = vi.spyOn(apiClient, 'get');

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      loginSessionToken: null,
      devOtpHive: null,
      login: vi.fn(),
      verifyOtp: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    render(
      <MemoryRouter>
        <PublicHomePage />
      </MemoryRouter>
    );

    // 1. Semantic landmarks
    expect(screen.getByRole('banner')).toBeInTheDocument(); // header
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content'); // main

    // 2. Accessibility skip link
    const skipLink = screen.getByText(/skip to main content/i);
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');

    // 3. Zero API calls: rendering does NOT make runtime backend calls
    expect(apiSpy).not.toHaveBeenCalled();
  });

  it('renders the 3-line distinct headline in cyan, white, and sky blue', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      loginSessionToken: null,
      devOtpHive: null,
      login: vi.fn(),
      verifyOtp: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    render(
      <MemoryRouter>
        <PublicHomePage />
      </MemoryRouter>
    );

    expect(screen.getByText('Streamlining')).toHaveClass('text-cyan-400');
    expect(screen.getByText('Security Deposits')).toHaveClass('text-white');
    expect(screen.getByText('& FDRs')).toHaveClass('text-blue-400');
  });

  it('renders Login when unauthenticated and opens "How it works" modal without page scroll', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      loginSessionToken: null,
      devOtpHive: null,
      login: vi.fn(),
      verifyOtp: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    render(
      <MemoryRouter>
        <PublicHomePage />
      </MemoryRouter>
    );

    // Login buttons exist in header and hero
    const loginButtons = screen.getAllByRole('button', { name: /login/i });
    expect(loginButtons.length).toBeGreaterThan(0);

    // Click "How it works" button in hero to open modal
    const howItWorksBtn = screen.getByRole('button', { name: /how it works/i });
    fireEvent.click(howItWorksBtn);

    // Modal dialog is now visible with role="dialog"
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('How Saksham Works: End-to-End Lifecycle')).toBeInTheDocument();

    // Close on Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders "Go to my dashboard" when user is authenticated', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'inst-1',
        email: 'registrar@dtu.ac.in',
        full_name: 'Registrar DTU',
        role: 'INSTITUTION',
      },
      isAuthenticated: true,
      isLoading: false,
      loginSessionToken: null,
      devOtpHive: null,
      login: vi.fn(),
      verifyOtp: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    render(
      <MemoryRouter>
        <PublicHomePage />
      </MemoryRouter>
    );

    const dashboardButtons = screen.getAllByRole('button', { name: /go to my dashboard/i });
    expect(dashboardButtons.length).toBeGreaterThan(0);
  });

  it('opens Modules modal and displays core system modules including AI NL Search', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      loginSessionToken: null,
      devOtpHive: null,
      login: vi.fn(),
      verifyOtp: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    render(
      <MemoryRouter>
        <PublicHomePage />
      </MemoryRouter>
    );

    // Open Modules modal via navigation button
    const modulesBtn = screen.getByRole('button', { name: /modules/i });
    fireEvent.click(modulesBtn);

    // Dialog is visible
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Core System Modules & Intelligent Tools')).toBeInTheDocument();

    // Verify key system modules are present in the dialog
    expect(screen.getByText(/Institutional Compliance Intelligence/i)).toBeInTheDocument();
    expect(screen.getByText(/Explainable AI Assistance/i)).toBeInTheDocument();
    expect(screen.getByText('Central Repository')).toBeInTheDocument();
    expect(screen.getByText('Verification & Discrepancy Detection')).toBeInTheDocument();
    expect(screen.getByText('Dashboards, Reports & NL Search')).toBeInTheDocument();
  });
});
