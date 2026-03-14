import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Grid, List, Users } from 'lucide-react';
import { getGroups, getDashboardGroups } from '@/services/api';
import { toast } from 'sonner';
import GroupCard from '@/components/dashboard/GroupCard';
import CreateGroupModal from '@/components/modals/CreateGroupModal';

export default function GroupsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // Fetch groups from API on component mount
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setLoading(true);
        // Fetch both regular groups and dashboard groups (with balances)
        const [allGroups, dashboardGroups] = await Promise.all([
          getGroups(),
          getDashboardGroups()
        ]);
        const transformedGroups = transformDashboardGroupData(dashboardGroups, allGroups);
        setGroups(transformedGroups);
      } catch (err) {
        toast.error('Failed to load groups', {
          description: err.message || 'Please check if the backend is running',
        });
        setGroups([]);
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
  }, []);

  // Filter groups by search query (client-side filtering)
  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle successful group creation - refresh groups list
  const handleGroupCreated = () => {
    const fetchGroups = async () => {
      try {
        setLoading(true);
        const [allGroups, dashboardGroups] = await Promise.all([
          getGroups(),
          getDashboardGroups()
        ]);
        const transformedGroups = transformDashboardGroupData(dashboardGroups, allGroups);
        setGroups(transformedGroups);
      } catch (err) {
        toast.error('Failed to refresh groups', {
          description: err.message || 'Please try again',
        });
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">My Groups</h1>
          <p className="text-muted-foreground mt-1">
            Manage your expense sharing groups
          </p>
        </div>
        <Button
          className="gap-2 w-full sm:w-auto"
          style={{ backgroundColor: 'hsl(168, 58%, 44%)' }}
          onClick={() => setCreateGroupOpen(true)}
        >
          <Plus className="w-4 h-4" />
          Create Group
        </Button>
      </div>

      {/* Search & View Toggle */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center border rounded-lg p-1 bg-muted/30">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'grid' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'list' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Groups */}
      {loading ? (
        // Loading state: Show skeleton cards
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'space-y-4'
          }
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
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
      ) : filteredGroups.length > 0 ? (
        // Success state: Show group cards
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'space-y-4'
          }
        >
          {filteredGroups.map((group, index) => (
            <GroupCard
              key={group.id}
              group={group}
              style={{ animationDelay: `${index * 50}ms` }}
            />
          ))}
        </div>
      ) : (
        // Empty state: No groups found
        <Card className="border-dashed">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: 'hsl(168, 45%, 92%)' }}
            >
              <Users className="w-8 h-8" style={{ color: 'hsl(168, 58%, 44%)' }} />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? 'No groups found' : 'No groups yet'}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              {searchQuery
                ? 'Try adjusting your search terms.'
                : 'Create a group to start splitting expenses with friends, roommates, or travel buddies.'}
            </p>
            {!searchQuery && (
              <Button
                onClick={() => setCreateGroupOpen(true)}
                style={{ backgroundColor: 'hsl(168, 58%, 44%)' }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create group
              </Button>
            )}
          </div>
        </Card>
      )}

      <CreateGroupModal
        open={createGroupOpen}
        onOpenChange={setCreateGroupOpen}
        onSuccess={handleGroupCreated}
      />
    </div>
  );
}
