import React from 'react';
import { Check, Circle } from 'lucide-react';
import { formatDateIST } from '../../utils/formatters';

export interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  timestamp?: string;
  actor?: string;
  status?: 'completed' | 'current' | 'upcoming' | 'error';
  badge?: React.ReactNode;
}

interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ items, className = '' }) => {
  return (
    <div className={`flow-root ${className}`}>
      <ul className="-mb-8">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          const statusStyles = {
            completed: 'bg-primary text-white border-primary',
            current: 'bg-accent text-slate-900 border-accent animate-pulse ring-4 ring-accent/20',
            upcoming: 'bg-white text-slate-300 border-slate-300',
            error: 'bg-red-600 text-white border-red-600',
          }[item.status || 'completed'];

          return (
            <li key={item.id} className="relative pb-8">
              {!isLast && (
                <span
                  className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-slate-200"
                  aria-hidden="true"
                />
              )}
              <div className="relative flex items-start space-x-3">
                <div>
                  <span
                    className={`h-8 w-8 rounded-full flex items-center justify-center border-2 ${statusStyles}`}
                  >
                    {item.status === 'completed' ? (
                      <Check className="w-4 h-4" />
                    ) : item.status === 'current' ? (
                      <Circle className="w-3.5 h-3.5 fill-current" />
                    ) : (
                      <Circle className="w-3.5 h-3.5" />
                    )}
                  </span>
                </div>

                <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      {item.badge}
                    </div>
                    {item.description && (
                      <p className="text-sm text-slate-600 mt-0.5">{item.description}</p>
                    )}
                    {item.actor && (
                      <p className="text-xs text-slate-400 mt-1">By: {item.actor}</p>
                    )}
                  </div>

                  {item.timestamp && (
                    <div className="text-right text-xs whitespace-nowrap text-slate-400 font-mono">
                      {formatDateIST(item.timestamp, true)}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
