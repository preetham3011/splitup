import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { getGroupMembers } from '@/services/api';

// Mock current user ID (in production, this comes from authentication)
const CURRENT_USER_ID = 'user_123';

export default function MembersTab({ group }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const groupId = group?.id;

  // Fetch members when component mounts or groupId changes
  useEffect(() => {
    const fetchMembers = async () => {
      if (!groupId) return;

      try {
        setLoading(true);
        setError(null);
        const data = await getGroupMembers(groupId);
        setMembers(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || 'Failed to load members');
        toast.error('Failed to load members', {
          description: err.message || 'Please check if the backend is running',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [groupId]);


  // Transform API members to UI format
  const transformedMembers = members.map((member) => {
    const isYou = member.user_id === CURRENT_USER_ID;
    const initials = member.name
      ? member.name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : member.user_id?.charAt(0).toUpperCase() || 'U';

    return {
      id: member.user_id,
      user_id: member.user_id,
      name: member.name || member.user_id,
      email: member.email || '—',  // Show "—" instead of fabricated email
      isYou,
      initials,
    };
  });

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Active Members</h2>
            <Skeleton className="h-4 w-32 mt-1" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="space-y-4 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error && members.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Active Members</h2>
            <p className="text-muted-foreground text-sm">Failed to load members</p>
          </div>
        </div>
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">Active Members</h2>
        <p className="text-muted-foreground text-sm mt-1">
          {transformedMembers.length} {transformedMembers.length === 1 ? 'member' : 'members'} in this group
        </p>
      </div>

      {/* Members Table/Cards */}
      {transformedMembers.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Name
                    </th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Email
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transformedMembers.map((member, index) => (
                    <tr
                      key={member.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback
                              style={
                                member.isYou
                                  ? { backgroundColor: 'hsl(168, 45%, 92%)', color: 'hsl(168, 58%, 44%)' }
                                  : {}
                              }
                            >
                              {member.initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">
                              {member.name}
                              {member.isYou && (
                                <span className="text-xs text-muted-foreground ml-2 font-normal">(You)</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-5">
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y">
              {transformedMembers.map((member, index) => (
                <div
                  key={member.id}
                  className="p-4 animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback
                        style={
                          member.isYou
                            ? { backgroundColor: 'hsl(168, 45%, 92%)', color: 'hsl(168, 58%, 44%)' }
                            : {}
                        }
                      >
                        {member.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{member.name}</p>
                        {member.isYou && <span className="text-xs text-muted-foreground">(You)</span>}
                      </div>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">No members in this group yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
