/**
 * Metadata API client — retrieves central document and instrument type registries.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import { queryKeys } from './queryKeys';

export interface DocumentTypeDefinition {
  code: string;
  label: string;
  description: string;
  applicable_instruments: string[];
  is_required: Record<string, boolean>;
  is_renewal_required: boolean;
  allowed_uploader_roles: string[];
  allowed_statuses: string[];
  accepted_mime_types: string[];
  has_ocr_profile: boolean;
  ocr_extractable_fields: string[];
}

export interface InstrumentTypeDefinition {
  type: 'FDR' | 'BANK_GUARANTEE' | string;
  label: string;
  description: string;
  required_documents: string[];
}

export interface DocumentRegistryResponse {
  document_types: DocumentTypeDefinition[];
  instrument_types: InstrumentTypeDefinition[];
  allowed_extensions: string[];
  max_file_size_mb: number;
}

export async function fetchDocumentRegistry(): Promise<DocumentRegistryResponse> {
  const response = await apiClient.get<DocumentRegistryResponse>('/meta/document-types');
  return response.data;
}

export function useDocumentRegistry() {
  return useQuery({
    queryKey: queryKeys.meta.documentTypes,
    queryFn: fetchDocumentRegistry,
    staleTime: 1000 * 60 * 30, // 30 minutes cache (static registry)
  });
}
