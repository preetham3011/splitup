import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Receipt,
  CreditCard,
  UserPlus,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { getActivity } from '@/services/api';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const activityIcons = {
  expense: Receipt,
  settlement: CreditCard,
  joined: UserPlus,
};

const activityColors = {
  expense: { bg: 'bg-amber-50', color: 'text-amber-600', iconColor: '#F59E0B' },
  settlement: { bg: 'bg-emerald-50', color: 'text-emerald-600', iconColor: '#10B981' },
  joined: { bg: 'bg-blue-50', color: 'text-blue-600', iconColor: '#3B82F6' },
};

export default function ActivityPage() {
  const [filter, setFilter] = useState('all');
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch activity feed
  useEffect(() => {
    const fetchActivity = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getActivity();
        setActivities(data.activities || []);
      } catch (err) {
        setError(err.message || 'Failed to load activity');
        toast.error('Failed to load activity', {
          description: err.message || 'Please check if the backend is running',
        });
        setActivities([]);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, []);

  const filteredActivity =
    filter === 'all'
      ? activities
      : activities.filter((item) => item.type === filter);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Activity Feed</h1>
        <p className="text-muted-foreground mt-1">
          Recent activity across all your groups
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {['all', 'expense', 'settlement'].map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
            className={cn(
              filter === f && 'border-0'
            )}
            style={
              filter === f
                ? { backgroundColor: 'hsl(168, 58%, 44%)' }
                : {}
            }
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {/* Activity List */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            // Loading state
            <div className="divide-y">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : error ? (
            // Error state
            <div className="text-center py-12">
              <p className="text-muted-foreground">{error}</p>
            </div>
          ) : filteredActivity.length > 0 ? (
            <div className="divide-y">
              {filteredActivity.map((item, index) => {
                const Icon = activityIcons[item.type] || Receipt;
                const colors = activityColors[item.type] || activityColors.expense;

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-5 hover:bg-muted/30 transition-colors animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div
                      className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                        colors.bg
                      )}
                    >
                      <Icon className="w-5 h-5" style={{ color: colors.iconColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground leading-snug">{item.message}</p>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {item.amount && (
                      <span
                        className={cn(
                          'font-semibold text-base flex-shrink-0',
                          item.type === 'settlement' ? 'text-emerald-600' : 'text-foreground'
                        )}
                      >
                        ₹{item.amount.toLocaleString()}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'hsl(168, 45%, 92%)' }}
              >
                <Receipt className="w-8 h-8" style={{ color: 'hsl(168, 58%, 44%)' }} />
              </div>
              <p className="text-lg font-medium text-foreground mb-1">No activity yet</p>
              <p className="text-sm text-muted-foreground">Activity from your groups will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
