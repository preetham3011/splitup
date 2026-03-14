import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, Check, Trash2, Users, Receipt, CreditCard } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const mockNotifications = [
  {
    id: '1',
    type: 'expense',
    title: 'New expense added',
    message: 'Mike added "Weekend Trip Cab" (₹3,450) in Apartment 402',
    timestamp: '2 hours ago',
    read: false,
  },
  {
    id: '2',
    type: 'payment',
    title: 'Payment received',
    message: 'Sarah settled ₹450 with you',
    timestamp: '1 day ago',
    read: false,
  },
  {
    id: '3',
    type: 'reminder',
    title: 'Payment reminder',
    message: 'You owe Mike ₹1,250 for WiFi & Electricity Bill',
    timestamp: '2 days ago',
    read: true,
  },
  {
    id: '4',
    type: 'group',
    title: 'New member joined',
    message: 'David Kim joined Apartment 402',
    timestamp: '1 week ago',
    read: true,
  },
];

const notificationIcons = {
  expense: Receipt,
  payment: CreditCard,
  reminder: Bell,
  group: Users,
};

const notificationColors = {
  expense: { bg: 'bg-amber-50', color: 'text-amber-600' },
  payment: { bg: 'bg-emerald-50', color: 'text-emerald-600' },
  reminder: { bg: 'bg-red-50', color: 'text-red-500' },
  group: { bg: 'bg-blue-50', color: 'text-blue-600' },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(mockNotifications);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success('All notifications marked as read');
  };

  const markAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const deleteNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    toast.success('Notification deleted');
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Notifications</h1>
          <p className="text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="gap-2">
            <Check className="w-4 h-4" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Notifications List */}
      <Card>
        <CardContent className="p-0">
          {notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map((notification, index) => {
                const Icon = notificationIcons[notification.type] || Bell;
                const colors = notificationColors[notification.type] || notificationColors.reminder;

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      'flex items-start gap-4 p-4 transition-colors animate-fade-in',
                      !notification.read && 'bg-muted/30'
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                        colors.bg
                      )}
                    >
                      <Icon className={cn('w-5 h-5', colors.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={cn('text-sm', !notification.read && 'font-semibold')}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {notification.timestamp}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {!notification.read && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => markAsRead(notification.id)}
                              title="Mark as read"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteNotification(notification.id)}
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    {!notification.read && (
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0 mt-2"
                        style={{ backgroundColor: 'hsl(168, 58%, 44%)' }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'hsl(168, 45%, 92%)' }}
              >
                <Bell className="w-8 h-8" style={{ color: 'hsl(168, 58%, 44%)' }} />
              </div>
              <p className="text-muted-foreground">No notifications</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
