import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { RequireRole } from '../src/features/auth/RequireRole';
import * as AuthContextModule from '../src/features/auth/AuthContext';

describe('RequireRole Route Guard', () => {
  it('renders children when user role matches allowed roles', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'user-1',
        email: 'officer@aicte-india.org',
        full_name: 'Officer User',
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
        <RequireRole allowedRoles={['VERIFYING_OFFICER', 'ADMIN']}>
          <div data-testid="protected-content">Officer Console Protected Content</div>
        </RequireRole>
      </MemoryRouter>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('renders 403 Forbidden screen when user role lacks clearance', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'inst-1',
        email: 'inst@college.edu.in',
        full_name: 'College User',
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
        <RequireRole allowedRoles={['VERIFYING_OFFICER', 'ADMIN']}>
          <div data-testid="protected-content">Officer Only</div>
        </RequireRole>
      </MemoryRouter>
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByText('403 — Access Forbidden')).toBeInTheDocument();
  });
});
