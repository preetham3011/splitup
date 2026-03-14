import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { UserPlus, Plus, Users, TrendingUp, ArrowUpRight, ArrowDownLeft, Wallet } from 'lucide-react';
import { getGroups, getDashboardStats, getDashboardGroups } from '@/services/api';
import { toast } from 'sonner';
import StatCard from '@/components/dashboard/StatCard';
import GroupCard from '@/components/dashboard/GroupCard';
import CreateGroupModal from '@/components/modals/CreateGroupModal';
import JoinGroupModal from '@/components/modals/JoinGroupModal';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const userName = user?.name?.split(' ')[0] || 'User';
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [joinGroupOpen, setJoinGroupOpen] = useState(false);
  const [groups, setGroups] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Transform dashboard groups API response to match GroupCard expectations
  const transformDashboardGroupData = (dashboardGroups, allGroups) => {
    // dashboardGroups has: { group_id, name, type, your_balance, total_spent, member_count, budget_percent }
    // GroupCard expects: { id, name, type, memberCount, members: [...], balances: { yourBalance }, budget_percent }
    return dashboardGroups.map((dGroup) => {
      // Find corresponding group data for members info
      const fullGroup = allGroups.find(g => g.id === dGroup.group_id) || {};
      
      return {
        id: dGroup.group_id,
        name: dGroup.name,
        type: dGroup.type,
        memberCount: dGroup.member_count,
        members: (fullGroup.members || []).map((member) => ({
          ...member,
          id: member.user_id,
          avatar_url: member.avatar_url || null,
        })),
        balances: {
          yourBalance: dGroup.your_balance, // Real balance from backend
        },
        budget_percent: dGroup.budget_percent, // Real budget percentage from backend
      };
    });
  };

  // Fetch dashboard stats from API
  const fetchDashboardStats = async () => {
    try {
      setStatsLoading(true);
      const statsData = await getDashboardStats();
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
      // Don't show error toast for stats - degrade gracefully
      setStats({ groups_count: 0, total_spent: 0, you_owe: 0, you_are_owed: 0 });
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch groups from API (extracted to function so it can be called after group creation)
  const fetchGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch both regular groups and dashboard groups (with balances)
      const [allGroups, dashboardGroups] = await Promise.all([
        getGroups(),
        getDashboardGroups()
      ]);
      
      const transformedGroups = transformDashboardGroupData(dashboardGroups, allGroups);
      setGroups(transformedGroups);
    } catch (err) {
      setError(err.message);
      toast.error('Failed to load groups', {
        description: err.message || 'Please check if the backend is running',
      });
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch groups and stats on component mount
  useEffect(() => {
    fetchGroups();
    fetchDashboardStats();
  }, []);

  // Handle successful group creation - refresh groups list and stats
  const handleGroupCreated = () => {
    fetchGroups();
    fetchDashboardStats();
  };

  // Handle successful group join - refresh groups list and stats
  const handleGroupJoined = () => {
    fetchGroups();
    fetchDashboardStats();
  };

  // Show only first 3 groups (same as before with mock data)
  const groupsArray = groups.slice(0, 3);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold text-foreground">
            Hi, {userName} <span className="inline-block animate-wave">👋</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening with your expenses.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <Button
            className="gap-2"
            style={{ backgroundColor: 'hsl(168, 58%, 44%)' }}
            onClick={() => setCreateGroupOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Create Group
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setJoinGroupOpen(true)}
          >
            <UserPlus className="w-4 h-4" />
            Join Group
          </Button>
        </div>
      </header>

      {/* Stats Grid - Real data from backend */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Groups"
          value={statsLoading ? '...' : (stats?.groups_count || 0)}
          subtitle="Active memberships"
          icon={Users}
          iconColor="#3B82F6"
          iconBg="#EFF6FF"
        />
        <StatCard
          title="Total Spent"
          value={statsLoading ? '...' : `₹${(stats?.total_spent || 0).toLocaleString()}`}
          subtitle="Across all groups"
          icon={TrendingUp}
          iconColor="#10B981"
          iconBg="#ECFDF5"
        />
        <StatCard
          title="You owe"
          value={statsLoading ? '...' : `₹${(stats?.you_owe || 0).toLocaleString()}`}
          subtitle={stats?.you_owe > 0 ? 'Outstanding debt' : 'All clear'}
          valueColor="text-destructive"
          icon={ArrowUpRight}
          iconColor="#EF4444"
          iconBg="#FEF2F2"
        />
        <StatCard
          title="You are owed"
          value={statsLoading ? '...' : `₹${(stats?.you_are_owed || 0).toLocaleString()}`}
          subtitle={stats?.you_are_owed > 0 ? 'To be received' : 'All settled'}
          valueColor="text-emerald-600"
          icon={ArrowDownLeft}
          iconColor="#10B981"
          iconBg="#ECFDF5"
        />
      </div>

      {/* My Groups Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">My Groups</h2>
          <Link
            to="/dashboard/groups"
            className="text-sm font-medium hover:underline"
            style={{ color: 'hsl(168, 58%, 44%)' }}
          >
            View all
          </Link>
        </div>

        {loading ? (
          // Loading state: Show skeleton cards
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden border-border/50">
                <div className="h-1 bg-muted" />
                <div className="p-5 space-y-4">
                  <div className="flex items-start gap-4">
                    <Skeleton className="w-12 h-12 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              </Card>
            ))}
          </div>
        ) : groupsArray.length > 0 ? (
          // Success state: Show group cards
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupsArray.map((group, index) => (
              <GroupCard
                key={group.id}
                group={group}
                style={{ animationDelay: `${index * 100}ms` }}
              />
            ))}
          </div>
        ) : (
          // Empty state: No groups found
          <EmptyGroupsState
            onCreateGroup={() => setCreateGroupOpen(true)}
            onJoinGroup={() => setJoinGroupOpen(true)}
          />
        )}
      </section>

      {/* Modals */}
      <CreateGroupModal
        open={createGroupOpen}
        onOpenChange={setCreateGroupOpen}
        onSuccess={handleGroupCreated}
      />
      <JoinGroupModal
        open={joinGroupOpen}
        onOpenChange={setJoinGroupOpen}
        onSuccess={handleGroupJoined}
      />
    </div>
  );
}

function EmptyGroupsState({ onCreateGroup, onJoinGroup }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style={{ backgroundColor: 'hsl(168, 45%, 92%)' }}
        >
          <Users className="w-8 h-8" style={{ color: 'hsl(168, 58%, 44%)' }} />
        </div>
        <h3 className="text-lg font-semibold mb-2">No groups yet</h3>
        <p className="text-muted-foreground mb-6 max-w-sm">
          Create a group to start splitting expenses with friends, roommates, or travel buddies.
        </p>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onJoinGroup}>
            Join a group
          </Button>
          <Button
            onClick={onCreateGroup}
            style={{ backgroundColor: 'hsl(168, 58%, 44%)' }}
          >
            Create group
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
