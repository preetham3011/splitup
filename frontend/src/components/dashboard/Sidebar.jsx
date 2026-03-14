import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { SplitupLogoSmall } from '@/components/SplitupLogo';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  LayoutDashboard,
  Users,
  Activity,
  Settings,
  Bell,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const overviewItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/groups', label: 'My Groups', icon: Users },
  { href: '/dashboard/activity', label: 'Activity', icon: Activity },
];

const preferencesItems = [
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  // Notifications feature not yet implemented - hidden for now
  // { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
];

export default function Sidebar({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const isActive = (href) => {
    if (href === '/dashboard') {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  const handleLogout = () => {
    setLogoutModalOpen(true);
  };

  const confirmLogout = () => {
    logout();
    setLogoutModalOpen(false);
    toast.success('Signed out successfully');
    navigate('/login');
  };

  return (
    <aside
      className={cn(
        'bg-card border-r border-border min-h-screen flex flex-col transition-all duration-300',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className={cn('p-6 flex items-center', collapsed ? 'justify-center' : 'justify-between')}>
        {!collapsed && <SplitupLogoSmall />}
        {collapsed && (
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'hsl(168, 58%, 44%)' }}
          >
            <span className="text-white font-bold text-sm">sU</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3">
        {/* Overview Section */}
        <div className="mb-6">
          {!collapsed && (
            <p className="px-4 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Overview
            </p>
          )}
          <ul className="space-y-1">
            {overviewItems.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                      collapsed && 'justify-center px-3',
                      active
                        ? 'text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                    style={active ? { backgroundColor: 'hsl(168, 45%, 92%)', color: 'hsl(168, 58%, 44%)' } : {}}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Preferences Section */}
        <div>
          {!collapsed && (
            <p className="px-4 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Preferences
            </p>
          )}
          <ul className="space-y-1">
            {preferencesItems.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                      collapsed && 'justify-center px-3',
                      active
                        ? 'text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                    style={active ? { backgroundColor: 'hsl(168, 45%, 92%)', color: 'hsl(168, 58%, 44%)' } : {}}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-border">
        <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
          <Avatar className="w-10 h-10 flex-shrink-0">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback
              className="text-sm font-medium"
              style={{ backgroundColor: 'hsl(168, 45%, 92%)', color: 'hsl(168, 58%, 44%)' }}
            >
              {user?.name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      <Dialog open={logoutModalOpen} onOpenChange={setLogoutModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to log out? You'll need to sign in again to access your account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLogoutModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmLogout}
              style={{ backgroundColor: 'hsl(168, 58%, 44%)' }}
            >
              Log Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
