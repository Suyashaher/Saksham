export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  instruments: {
    all: ['instruments'] as const,
    list: (params?: Record<string, unknown>) => ['instruments', 'list', params] as const,
    detail: (id: string) => ['instruments', 'detail', id] as const,
    documents: (id: string) => ['instruments', 'documents', id] as const,
    statusHistory: (id: string) => ['instruments', 'statusHistory', id] as const,
    lineage: (id: string) => ['instruments', 'lineage', id] as const,
    bankVerification: (id: string) => ['instruments', 'bankVerification', id] as const,
    search: (filters: Record<string, unknown>) => ['instruments', 'search', filters] as const,
  },
  releases: {
    all: ['releases'] as const,
    list: (params?: Record<string, unknown>) => ['releases', 'list', params] as const,
    detail: (id: string) => ['releases', 'detail', id] as const,
    conditions: (id: string) => ['releases', 'conditions', id] as const,
  },
  officer: {
    queue: (params?: Record<string, unknown>) => ['officer', 'queue', params] as const,
    dashboard: ['officer', 'dashboard'] as const,
  },
  alerts: {
    all: ['alerts'] as const,
    list: (params?: Record<string, unknown>) => ['alerts', 'list', params] as const,
    rules: ['alerts', 'rules'] as const,
  },
  admin: {
    users: (params?: Record<string, unknown>) => ['admin', 'users', params] as const,
    institutions: (params?: Record<string, unknown>) => ['admin', 'institutions', params] as const,
    releaseConditions: ['admin', 'releaseConditions'] as const,
    auditLogs: (params?: Record<string, unknown>) => ['admin', 'auditLogs', params] as const,
    metrics: ['admin', 'metrics'] as const,
  },
  reports: {
    summary: (params?: Record<string, unknown>) => ['reports', 'summary', params] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: (params?: Record<string, unknown>) => ['notifications', 'list', params] as const,
    unreadCount: ['notifications', 'unreadCount'] as const,
  },
  meta: {
    documentTypes: ['meta', 'documentTypes'] as const,
  },
  ai: {
    config: ['ai', 'config'] as const,
    trustScore: (instrumentId: string) => ['ai', 'trustScore', instrumentId] as const,
    predictedTime: (instrumentId: string) => ['ai', 'predictedTime', instrumentId] as const,
    feedbackStats: (windowDays?: number) => ['ai', 'feedbackStats', windowDays] as const,
    weights: ['ai', 'weights'] as const,
    models: ['ai', 'models'] as const,
    nlSearch: (query: string) => ['ai', 'nlSearch', query] as const,
    ocrRuns: (instrumentId: string) => ['ai', 'ocrRuns', instrumentId] as const,
  },
};
