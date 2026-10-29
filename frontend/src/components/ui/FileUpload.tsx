import React, { useRef, useState } from 'react';
import { UploadCloud, File, X, AlertCircle, CheckCircle2 } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  allowedTypes?: string[]; // e.g. ['application/pdf', 'image/jpeg', 'image/png']
  maxSizeMB?: number; // default 10MB matching backend
  disabled?: boolean;
  label?: string;
  hint?: string;
  className?: string;
}

const DEFAULT_ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
const DEFAULT_MAX_MB = 10;

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  selectedFile,
  allowedTypes = DEFAULT_ALLOWED,
  maxSizeMB = DEFAULT_MAX_MB,
  disabled = false,
  label = 'Upload Instrument Document',
  hint = 'Supported formats: PDF, JPEG, PNG up to 10 MB. Document will be encrypted using AES-256-GCM.',
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSet = (file: File) => {
    setErrorMessage(null);

    if (!allowedTypes.includes(file.type)) {
      setErrorMessage(`Invalid file type (${file.type || 'unknown'}). Only PDF, JPEG, and PNG are accepted.`);
      return false;
    }

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      setErrorMessage(`File is too large (${fileSizeMB.toFixed(1)} MB). Maximum allowed size is ${maxSizeMB} MB.`);
      return false;
    }

    onFileSelect(file);
    return true;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndSet(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      validateAndSet(file);
    }
  };

  const handleRemove = () => {
    onFileSelect(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`w-full flex flex-col gap-2 ${className}`}>
      {label && <label className="text-sm font-semibold text-slate-800">{label}</label>}

      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          tabIndex={disabled ? -1 : 0}
          role="button"
          aria-label="Upload document dropzone"
          className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
            disabled
              ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200'
              : isDragging
              ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
              : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleInputChange}
            disabled={disabled}
            className="sr-only"
          />
          <UploadCloud className="w-10 h-10 text-slate-400 mb-2" />
          <p className="text-sm font-medium text-slate-700">
            Click to upload or drag and drop file here
          </p>
          <p className="text-xs text-slate-500 mt-1 text-center">{hint}</p>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 bg-primary/10 rounded-md text-primary shrink-0">
              <File className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{selectedFile.name}</p>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                <span>•</span>
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Ready for upload
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
            aria-label="Remove uploaded file"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 p-2.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
