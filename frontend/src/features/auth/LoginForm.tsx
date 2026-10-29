import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Lock, AlertCircle, Eye, EyeOff, Sparkles, Building2, ShieldCheck, CheckSquare, ShieldAlert } from 'lucide-react';
import { loginSchema, LoginFormData } from '../../utils/validation';
import { useAuth } from './AuthContext';
import { Button } from '../../components/ui/Button';
import { formatApiError } from '../../api/client';

interface LoginFormProps {
  onSuccess: (sessionToken: string, devOtp?: string) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'registrar@dtu.ac.in',
      password: 'Inst1@AICTE2026!',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    setIsLoading(true);

    try {
      const res = await login(data.email, data.password);
      if (!res.direct) {
        onSuccess(res.session_token, res.dev_otp);
      }
    } catch (err: any) {
      const msg = formatApiError(
        err,
        'Authentication failed. Please verify your email and password.'
      );
      setServerError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemo = (email: string, pass: string) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', pass, { shouldValidate: true });
  };

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Sign In to Saksham Portal</h2>
        <p className="text-xs text-slate-600 mt-1">
          Authorized personnel and institutional representatives only
        </p>
      </div>

      {serverError && (
        <div className="mb-4 flex items-center gap-2.5 p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span className="font-medium">{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-800 mb-1.5">
            Registered Email ID
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="email"
              placeholder="officer@aicte.gov.in"
              {...register('email')}
              className={`w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary shadow-xs transition-colors ${
                errors.email ? 'border-red-400 focus:ring-red-400' : 'border-slate-300'
              }`}
            />
          </div>
          {errors.email && (
            <p className="text-xs font-medium text-red-600 mt-1">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-800 mb-1.5">
            Account Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••••••"
              {...register('password')}
              className={`w-full pl-10 pr-10 py-2.5 text-sm bg-white border rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary shadow-xs transition-colors ${
                errors.password ? 'border-red-400 focus:ring-red-400' : 'border-slate-300'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs font-medium text-red-600 mt-1">{errors.password.message}</p>
          )}
        </div>

        <Button
          type="submit"
          variant="black"
          size="lg"
          isLoading={isLoading}
          className="w-full mt-3 font-bold shadow-md hover:shadow-lg transition-all"
        >
          Sign In
        </Button>
      </form>

      {/* Quick-Fill Demo Credentials Helper */}
      <div className="mt-6 pt-5 border-t border-slate-200">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Quick Demo Logins</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleFillDemo('registrar@dtu.ac.in', 'Inst1@AICTE2026!')}
            className="flex items-center gap-1.5 p-2 rounded-md border border-slate-200 bg-slate-50 hover:bg-primary-50 hover:border-primary-200 text-left transition-colors text-xs font-medium text-slate-700"
          >
            <Building2 className="w-3.5 h-3.5 text-primary" />
            <span className="truncate">DTU (Institution)</span>
          </button>
          <button
            type="button"
            onClick={() => handleFillDemo('officer@aicte.gov.in', 'Officer@AICTE2026!')}
            className="flex items-center gap-1.5 p-2 rounded-md border border-slate-200 bg-slate-50 hover:bg-primary-50 hover:border-primary-200 text-left transition-colors text-xs font-medium text-slate-700"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            <span className="truncate">Verifying Officer</span>
          </button>
          <button
            type="button"
            onClick={() => handleFillDemo('approver@aicte.gov.in', 'Approver@AICTE2026!')}
            className="flex items-center gap-1.5 p-2 rounded-md border border-slate-200 bg-slate-50 hover:bg-primary-50 hover:border-primary-200 text-left transition-colors text-xs font-medium text-slate-700"
          >
            <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
            <span className="truncate">Approver</span>
          </button>
          <button
            type="button"
            onClick={() => handleFillDemo('admin@aicte.gov.in', 'Admin@AICTE2026!')}
            className="flex items-center gap-1.5 p-2 rounded-md border border-slate-200 bg-slate-50 hover:bg-primary-50 hover:border-primary-200 text-left transition-colors text-xs font-medium text-slate-700"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
            <span className="truncate">Admin</span>
          </button>
        </div>
      </div>
    </div>
  );
};
