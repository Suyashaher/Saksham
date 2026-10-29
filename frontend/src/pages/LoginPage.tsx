import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LoginForm } from '../features/auth/LoginForm';
import { OtpForm } from '../features/auth/OtpForm';
import { useAuth } from '../features/auth/AuthContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loginSessionToken, devOtpHive } = useAuth();
  const [activeSession, setActiveSession] = useState<string | null>(loginSessionToken);
  const [activeDevOtp, setActiveDevOtp] = useState<string | null>(devOtpHive);

  const rawFrom = (location.state as any)?.from?.pathname;
  const destination = rawFrom && rawFrom !== '/' ? rawFrom : '/app';

  useEffect(() => {
    if (user) {
      navigate(destination, { replace: true });
    }
  }, [user, navigate, destination]);

  const handleLoginSuccess = (sessionToken: string, devOtp?: string) => {
    setActiveSession(sessionToken);
    if (devOtp) {
      setActiveDevOtp(devOtp);
    }
  };

  const handleOtpSuccess = () => {
    navigate(destination, { replace: true });
  };

  return (
    <div>
      {!activeSession ? (
        <LoginForm onSuccess={handleLoginSuccess} />
      ) : (
        <OtpForm
          sessionToken={activeSession}
          devOtpHint={activeDevOtp}
          onSuccess={handleOtpSuccess}
          onBack={() => setActiveSession(null)}
        />
      )}
    </div>
  );
};
