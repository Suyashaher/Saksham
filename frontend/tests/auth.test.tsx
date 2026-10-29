import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../src/features/auth/AuthContext';
import { apiClient, setAccessToken, getAccessToken } from '../src/api/client';

// Mock test consumer component
const TestAuthConsumer: React.FC = () => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  if (isLoading) return <div>Loading Auth...</div>;
  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'LOGGED_IN' : 'LOGGED_OUT'}</div>
      {user && <div data-testid="user-role">{user.role}</div>}
      <button onClick={logout}>Sign Out</button>
    </div>
  );
};

describe('AuthContext & Token Storage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    setAccessToken(null);
  });

  it('initializes in logged-out state when no session token exists', async () => {
    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    expect(await screen.findByTestId('auth-status')).toHaveTextContent('LOGGED_OUT');
  });

  it('keeps access token strictly in-memory without exposing in localStorage', () => {
    setAccessToken('mock_access_jwt');
    expect(getAccessToken()).toBe('mock_access_jwt');
    expect(localStorage.getItem('access_token')).toBeNull();
  });
});
