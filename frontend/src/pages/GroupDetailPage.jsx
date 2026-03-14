import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getGroupById, getGroupStats } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronRight,
  ChevronLeft,
  Home,
  Plane,
  Heart,
  Users,
  Link as LinkIcon,
  Copy,
  Check,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Tab components
import ExpensesTab from '@/components/group-detail/ExpensesTab';
import BalancesTab from '@/components/group-detail/BalancesTab';
import BudgetsTab from '@/components/group-detail/BudgetsTab';
import MembersTab from '@/components/group-detail/MembersTab';
import SettingsTab from '@/components/group-detail/SettingsTab';
import AddExpenseModal from '@/components/modals/AddExpenseModal';
const tabs = [
  { id: 'expenses', label: 'Expenses' },
  { id: 'balances', label: 'Balances' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'members', label: 'Members' },
  { id: 'settings', label: 'Settings' },
];

const typeIcons = {
  home: Home,
  trip: Plane,
  couple: Heart,
  other: Users,
};

export default function GroupDetailPage() {
  const { groupId, tab = 'expenses' } = useParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [group, setGroup] = useState(null);
  const [groupStats, setGroupStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshBalancesTrigger, setRefreshBalancesTrigger] = useState(0);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);

  // Fetch group stats from API
  const fetchGroupStats = async () => {
    if (!groupId) return;

    try {
      setStatsLoading(true);
      const stats = await getGroupStats(groupId);
      setGroupStats(stats);
    } catch (err) {
      console.error('Failed to load group stats:', err);
      // Degrade gracefully
      setGroupStats({ total_spent: 0, your_balance: 0, budget_used: 0, budget_limit: 0, budget_percent: 0 });
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch group data from API
  const fetchGroup = async () => {
    if (!groupId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await getGroupById(groupId);
      
      // Transform API response to match component expectations
      const transformedGroup = {
        ...data,
        memberCount: data.member_count || data.members?.length || 0,
        members: (data.members || []).map((member) => ({
          ...member,
          id: member.user_id,
          avatar_url: member.avatar_url || null,
        })),
        createdAt: data.created_at 
          ? new Date(data.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
          : 'Unknown',
      };
      
      setGroup(transformedGroup);
    } catch (err) {
      setError(err.message);
      toast.error('Failed to load group', {
        description: err.message || 'Please check if the backend is running',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroup();
    fetchGroupStats();
  }, [groupId]);

  // Redirect to expenses tab if invalid tab
  useEffect(() => {
    if (!tabs.find((t) => t.id === tab)) {
      navigate(`/dashboard/groups/${groupId}/expenses`, { replace: true });
    }
  }, [tab, groupId, navigate]);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-2 text-sm">
          <Skeleton className="h-4 w-16" />
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Error state or group not found
  if (error || !group) {
    return (
      <div className="flex flex-col items-center justify-center h-64 animate-fade-in">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style={{ backgroundColor: 'hsl(168, 45%, 92%)' }}
        >
          <Users className="w-8 h-8" style={{ color: 'hsl(168, 58%, 44%)' }} />
        </div>
        <p className="text-lg font-medium text-foreground mb-2">Group not found</p>
        <p className="text-muted-foreground mb-4">This group doesn't exist or was deleted.</p>
        <Link to="/dashboard/groups">
          <Button variant="outline" className="gap-2">
            <ChevronLeft className="w-4 h-4" />
            Back to groups
          </Button>
        </Link>
      </div>
    );
  }

  const TypeIcon = typeIcons[group.type] || Users;

  const copyInviteCode = () => {
    if (group?.invite_code) {
      navigator.clipboard.writeText(group.invite_code);
      setCopied(true);
      toast.success('Invite code copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleTabChange = (newTab) => {
    navigate(`/dashboard/groups/${groupId}/${newTab}`);
  };

  // Handle refresh balances callback from ExpensesTab - also refresh stats
  const handleRefreshBalances = () => {
    setRefreshBalancesTrigger((prev) => prev + 1);
    fetchGroupStats(); // Refresh stats when balances change
  };

  // Handle expense added from header button
  const handleExpenseAdded = () => {
    handleRefreshBalances();
  };

  const renderTabContent = () => {
    if (!group) return null;
    
    switch (tab) {
      case 'expenses':
        return (
          <ExpensesTab
            groupId={groupId}
            group={group}
            onRefreshBalances={handleRefreshBalances}
          />
        );
      case 'balances':
        return (
          <BalancesTab
            groupId={groupId}
            group={group}
            onRefresh={refreshBalancesTrigger}
          />
        );
      case 'budgets':
        return <BudgetsTab group={group} />;
      case 'members':
        return <MembersTab group={group} />;
      case 'settings':
        return (
          <SettingsTab
            group={group}
            groupId={groupId}
            onGroupUpdate={fetchGroup}
            onGroupDelete={() => {
              navigate('/dashboard/groups');
              toast.success('Group deleted successfully');
            }}
          />
        );
      default:
        return (
          <ExpensesTab
            groupId={groupId}
            group={group}
            onRefreshBalances={handleRefreshBalances}
          />
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link to="/dashboard/groups" className="text-muted-foreground hover:text-foreground transition-colors">
          Groups
        </Link>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium text-foreground">{group.name}</span>
      </div>

      {/* Group Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">{group.name}</h1>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'hsl(168, 45%, 92%)' }}
            >
              <TypeIcon className="w-4 h-4" style={{ color: 'hsl(168, 58%, 44%)' }} />
            </div>
          </div>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Created {group.createdAt}</span>
            <button
              onClick={copyInviteCode}
              className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full hover:bg-muted/80 transition-colors"
            >
              <LinkIcon className="w-3 h-3" />
              <span className="text-sm font-medium">Invite: {group.invite_code || 'N/A'}</span>
              {copied ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : (
                <Copy className="w-3 h-3 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            className="gap-2"
            style={{ backgroundColor: 'hsl(168, 58%, 44%)' }}
            onClick={() => setAddExpenseOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </Button>
          <Button
            className="gap-2"
            style={{ backgroundColor: 'hsl(168, 58%, 44%)' }}
            onClick={() => {
              if (group?.invite_code) {
                navigator.clipboard.writeText(group.invite_code);
                toast.info('Invite code copied!', { description: group.invite_code });
              }
            }}
          >
            <Users className="w-4 h-4" />
            Invite Member
          </Button>
        </div>
      </div>

      {/* Stats Summary - Real data from backend */}
      <div className={`grid gap-4 ${(groupStats?.budget_limit || 0) > 0 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Members</p>
          <p className="text-2xl font-bold mt-1">{group.memberCount}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Spent</p>
          <p className="text-2xl font-bold mt-1">
            {statsLoading ? '...' : `₹${(groupStats?.total_spent || 0).toLocaleString()}`}
          </p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Your Balance</p>
          <p 
            className="text-2xl font-bold mt-1" 
            style={{ 
              color: statsLoading ? 'inherit' : 
                (groupStats?.your_balance || 0) > 0 ? '#10B981' : 
                (groupStats?.your_balance || 0) < 0 ? '#EF4444' : 
                'hsl(168, 58%, 44%)'
            }}
          >
            {statsLoading ? '...' : `₹${Math.abs(groupStats?.your_balance || 0).toLocaleString()}`}
          </p>
        </div>
        {/* Only show Budget Used if budgets exist */}
        {!statsLoading && (groupStats?.budget_limit || 0) > 0 && (
          <div className="bg-card rounded-xl border p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Budget Used</p>
            <p className="text-2xl font-bold mt-1">
              {`${Math.round(groupStats?.budget_percent || 0)}%`}
            </p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                tab === t.id
                  ? 'border-b-2'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
              )}
              style={
                tab === t.id
                  ? { borderColor: 'hsl(168, 58%, 44%)', color: 'hsl(168, 58%, 44%)' }
                  : {}
              }
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in" key={tab}>
        {renderTabContent()}
      </div>

      {/* Add Expense Modal - Shared across all tabs */}
      <AddExpenseModal
        open={addExpenseOpen}
        onOpenChange={setAddExpenseOpen}
        groupId={groupId}
        members={group?.members || []}
        onSuccess={handleExpenseAdded}
      />
    </div>
  );
}
