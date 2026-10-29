import React, { useState, useRef, useEffect } from 'react';
import { ShieldCheck, AlertCircle, ArrowLeft, KeyRound, Sparkles } from 'lucide-react';
import { useAuth } from './AuthContext';
import { Button } from '../../components/ui/Button';
import { formatApiError } from '../../api/client';

interface OtpFormProps {
  sessionToken: string;
  devOtpHint?: string | null;
  onSuccess: () => void;
  onBack: () => void;
}

export const OtpForm: React.FC<OtpFormProps> = ({
  sessionToken,
  devOtpHint,
  onSuccess,
  onBack,
}) => {
  const { verifyOtp } = useAuth();
  const [otpValues, setOtpValues] = useState<string[]>(['', '', '', '', '', '']);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus the first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Pre-fill dev OTP if present (convenience in dev mode)
  useEffect(() => {
    if (devOtpHint && devOtpHint.length === 6) {
      const digits = devOtpHint.split('');
      setOtpValues(digits);
    }
  }, [devOtpHint]);

  const handleChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;

    const newValues = [...otpValues];
    newValues[index] = val.slice(-1);
    setOtpValues(newValues);

    // Auto-advance
    if (val && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pasted)) {
      const digits = pasted.split('');
      setOtpValues(digits);
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otpValues.join('');
    if (fullOtp.length !== 6) {
      setServerError('Please enter the complete 6-digit code.');
      return;
    }

    setServerError(null);
    setIsLoading(true);

    try {
      await verifyOtp(sessionToken, fullOtp);
      onSuccess();
    } catch (err: any) {
      const msg = formatApiError(err, 'Invalid or expired OTP. Please try again.');
      setServerError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-primary mb-4 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
      </button>

      <div className="mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3 border border-primary/20">
          <KeyRound className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Two-Factor Authentication</h2>
        <p className="text-xs text-slate-600 mt-1">
          Enter the 6-digit verification security code sent to your registered contact
        </p>
      </div>

      {devOtpHint && (
        <div className="mb-5 p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Dev Mode Security Code: <strong className="font-mono text-sm tracking-wider bg-amber-100 px-1.5 py-0.5 rounded text-amber-950 font-bold">{devOtpHint}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOtpValues(devOtpHint.split(''))}
            className="px-2.5 py-1 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-md transition-colors shadow-xs"
          >
            Auto-fill
          </button>
        </div>
      )}

      {serverError && (
        <div className="mb-4 flex items-center gap-2.5 p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span className="font-medium">{serverError}</span>
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-6">
        <div className="flex justify-between gap-2 sm:gap-3">
          {otpValues.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => (inputRefs.current[idx] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              onPaste={handlePaste}
              className="w-12 h-14 text-center text-xl font-bold font-mono bg-white border-2 border-slate-300 text-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary shadow-xs transition-all"
              aria-label={`Digit ${idx + 1}`}
            />
          ))}
        </div>

        <Button
          type="submit"
          variant="black"
          size="lg"
          isLoading={isLoading}
          leftIcon={<ShieldCheck className="w-5 h-5" />}
          className="w-full font-bold shadow-md hover:shadow-lg transition-all"
        >
          Verify & Access Portal
        </Button>
      </form>
    </div>
  );
};
