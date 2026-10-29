import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[500px] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg p-8 shadow-xs text-center space-y-4">
        <div className="w-14 h-14 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center mx-auto">
          <FileQuestion className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">404 — Page Not Found</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          The requested portal URL does not correspond to an authorized AICTE route or the record has been relocated.
        </p>
        <div className="pt-2">
          <Button variant="primary" size="md" onClick={() => navigate('/')}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};
