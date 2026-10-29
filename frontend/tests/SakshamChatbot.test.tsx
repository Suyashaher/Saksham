import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SakshamChatbot } from '../src/features/ai/chatbot/SakshamChatbot';
import * as AuthContextModule from '../src/features/auth/AuthContext';

describe('SakshamChatbot Component (Compliance & Explainable AI Role-Gating)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders floating launcher button when closed and opens on click', () => {
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
        <SakshamChatbot initialOpen={false} />
      </MemoryRouter>
    );

    // Launcher button is present
    const launcherBtn = screen.getByRole('button', { name: /open saksham ai copilot assistant/i });
    expect(launcherBtn).toBeInTheDocument();
    expect(screen.getByText('Saksham Copilot')).toBeInTheDocument();

    // Dialog is initially not present
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Click to open
    fireEvent.click(launcherBtn);

    // Dialog is now open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Saksham AI Copilot')).toBeInTheDocument();
  });

  it('allows logged-in INSTITUTION to access Compliance Intelligence but blocks Explainable AI', async () => {
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
        <SakshamChatbot initialOpen={true} defaultMode="compliance" />
      </MemoryRouter>
    );

    // 1. Compliance tab is active and unlocked
    expect(screen.getByText('4. Compliance')).toBeInTheDocument();
    expect(screen.getByText(/Logged-in Access/i)).toBeInTheDocument();
    expect(screen.getByText('Module 4: Compliance Intelligence Active')).toBeInTheDocument();

    // 2. Explainable AI tab shows lock badge
    expect(screen.getByText(/Officers Only/i)).toBeInTheDocument();

    // 3. Click Explainable AI tab
    const explainableTab = screen.getByRole('button', { name: /5. Explainable AI/i });
    fireEvent.click(explainableTab);

    // 4. Role-gating card is shown explaining the restriction
    await waitFor(() => {
      expect(
        screen.getByText('Explainable AI Restricted to Verifying Officers & Approvers')
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/Under AICTE Phase 7 Governance Invariants/i)).toBeInTheDocument();
  });

  it('processes DTU compliance and replacement FDR queries for logged-in user', async () => {
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
        <SakshamChatbot initialOpen={true} defaultMode="compliance" />
      </MemoryRouter>
    );

    // Click suggested DTU query preset
    const dtuPresetBtn = screen.getByRole('button', { name: 'DTU Compliance Status' });
    fireEvent.click(dtuPresetBtn);

    // User message is rendered
    expect(
      screen.getByText('What is Delhi Technological University (DTU) deposit compliance status?')
    ).toBeInTheDocument();

    // Wait for AI reply
    await waitFor(() => {
      expect(screen.getByText('COMPLIANT (100%)')).toBeInTheDocument();
    });

    expect(screen.getByText(/Mandatory Required Security Deposit/i)).toBeInTheDocument();
    expect(screen.getByText(/Zero Shortfall/i)).toBeInTheDocument();

    // Now test replacement FDR query
    const replacementBtn = screen.getByRole('button', { name: 'Submit Replacement FDR' });
    fireEvent.click(replacementBtn);

    await waitFor(() => {
      expect(screen.getByText('REPLACEMENT PROTOCOL')).toBeInTheDocument();
    });
    expect(screen.getByText(/Predecessor Linked/i)).toBeInTheDocument();
  });

  it('unlocks Explainable AI fully for VERIFYING_OFFICER and provides 10-Factor Trust Score breakdown', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'off-1',
        email: 'officer@aicte.gov.in',
        full_name: 'Verifying Officer',
        role: 'VERIFYING_OFFICER',
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
        <SakshamChatbot initialOpen={true} defaultMode="explainable" />
      </MemoryRouter>
    );

    // 1. Explainable AI tab is unlocked
    expect(screen.getByText(/Officer & Approver/i)).toBeInTheDocument();
    expect(
      screen.getByText('Module 5: Explainable AI Engine Active (Officers & Approvers)')
    ).toBeInTheDocument();

    // 2. Click Trust Score 72 preset
    const trustScorePreset = screen.getByRole('button', { name: 'Why Trust Score 72 on FDR-SBI?' });
    fireEvent.click(trustScorePreset);

    // 3. Wait for AI reply
    await waitFor(() => {
      expect(screen.getByText('NEEDS REVIEW (Score: 72)')).toBeInTheDocument();
    });

    // 4. Verify explainable factor breakdown table
    expect(screen.getByText('Factor Weight Decomposition:')).toBeInTheDocument();
    expect(screen.getByText('Bank Verification Status')).toBeInTheDocument();
    expect(screen.getByText('Issuing Bank Category')).toBeInTheDocument();
    expect(screen.getByText('Joint Lien AICTE Endorsement')).toBeInTheDocument();
  });

  it('allows APPROVING_AUTHORITY to query Approver Override & Audit invariants in Explainable AI', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'app-1',
        email: 'approver@aicte.gov.in',
        full_name: 'Approving Authority',
        role: 'APPROVING_AUTHORITY',
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
        <SakshamChatbot initialOpen={true} defaultMode="explainable" />
      </MemoryRouter>
    );

    // Click Approver Override & Audit preset
    const overridePreset = screen.getByRole('button', { name: 'Approver Override & Audit' });
    fireEvent.click(overridePreset);

    await waitFor(() => {
      expect(screen.getByText('IMMUTABLE AUDIT LOGGED')).toBeInTheDocument();
    });
    expect(screen.getByText(/Can an Approver approve an instrument despite an AI Discrepancy Flag\? YES\./i)).toBeInTheDocument();
    expect(screen.getByText(/SHA-256 Hash Chained Audit Entry/i)).toBeInTheDocument();
  });

  it('closes dialog on Escape key', () => {
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
        <SakshamChatbot initialOpen={true} />
      </MemoryRouter>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape' });

    // Dialog is closed, launcher is visible
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open saksham ai copilot assistant/i })).toBeInTheDocument();
  });
});
