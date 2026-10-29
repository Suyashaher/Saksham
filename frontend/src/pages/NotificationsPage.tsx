import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle2, Clock, Mail, MessageSquare } from 'lucide-react';
import { apiClient } from '../api/client';
import { queryKeys } from '../api/queryKeys';
import { formatDateIST } from '../utils/formatters';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';

interface NotificationItem {
  id: string;
  title?: string;
  message: string;
  channel: string;
  is_read: boolean;
  created_at: string;
}

export const NotificationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { success } = useToast();
  const [filterUnread, setFilterUnread] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.notifications.list({ unread_only: filterUnread }),
    queryFn: async () => {
      try {
        const res = await apiClient.get('/notifications', {
          params: { unread_only: filterUnread },
        });
        const list = Array.isArray(res.data) ? res.data : (res.data?.items || []);
        return list.map((item: any) => ({
          ...item,
          message: item.message || item.body || '',
          channel: item.channel || 'IN_APP',
        }));
      } catch {
        return [];
      }
    },
  });

  const notifications: NotificationItem[] = data || [];

  const handleMarkRead = async (notifId: string) => {
    try {
      await apiClient.post(`/notifications/${notifId}/read`);
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      success('Marked as read');
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient.post('/notifications/read-all');
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      success('All notifications marked as read');
    } catch {
      // ignore
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Institutional Notifications & Alerts"
        subtitle="Official communications, maturity reminders, and scrutiny status updates dispatched to your portal"
        breadcrumbs={[
          { label: 'Home', path: '/' },
          { label: 'Notifications' },
        ]}
      />

      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <h3 className="text-base font-bold text-slate-900">Message Inbox</h3>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={filterUnread}
                onChange={(e) => setFilterUnread(e.target.checked)}
                className="rounded text-primary focus:ring-primary"
              />
              <span>Unread Only</span>
            </label>
            {notifications.some((n) => !n.is_read) && (
              <Button
                variant="black"
                size="sm"
                onClick={handleMarkAllRead}
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
              >
                Mark All Read
              </Button>
            )}
          </div>
        </div>

        {notifications.length > 0 ? (
          <div className="divide-y divide-slate-200">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`py-3.5 flex items-start justify-between gap-4 transition-colors ${
                  !notif.is_read ? 'bg-blue-50/40 p-3 rounded-lg' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-slate-100 text-slate-600 shrink-0 mt-0.5">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <p className={`text-sm ${!notif.is_read ? 'font-bold text-slate-900' : 'text-slate-800'}`}>
                      {notif.title || 'Official AICTE Notice'}
                    </p>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.message}</p>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400">
                      <span>{formatDateIST(notif.created_at, true)}</span>
                      <span>•</span>
                      <span className="uppercase font-mono">{notif.channel}</span>
                    </div>
                  </div>
                </div>

                {!notif.is_read && (
                  <Button
                    variant="black"
                    size="sm"
                    onClick={() => handleMarkRead(notif.id)}
                    className="shrink-0"
                  >
                    Mark Read
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 py-8 text-center">
            No notifications in your inbox.
          </p>
        )}
      </div>
    </div>
  );
};
