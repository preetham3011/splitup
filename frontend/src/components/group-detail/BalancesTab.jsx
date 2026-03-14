import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRight, ArrowDownLeft, Users, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getGroupBalances } from '@/services/api';
import SettlementsModal from '@/components/modals/SettlementsModal';

export default function BalancesTab({ groupId, group, onRefresh }) {
  const [balances, setBalances] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [settlementsModalOpen, setSettlementsModalOpen] = useState(false);

  // Fetch balances from API
  const fetchBalances = async () => {
    if (!groupId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await getGroupBalances(groupId);
      
      // Transform API response to match component expectations
      // API returns: { group_id, your_balance, you_owe, you_are_owed, 
      //               people_you_owe: [{user_id, name, amount}], 
      //               people_who_owe_you: [{user_id, name, amount}] }
      // Component expects: { yourBalance, youOwe, youAreOwed,
      //                     peopleYouOwe: [{id, name, amount, reason}],
      //                     peopleWhoOweYou: [{id, name, amount, reason}],
      //                     otherBalances: [{from, to, amount}] }
      const transformedBalances = {
        yourBalance: data.your_balance || 0,
        youOwe: data.you_owe || 0,
        youAreOwed: data.you_are_owed || 0,
        peopleYouOwe: (data.people_you_owe || []).map((person) => ({
          id: person.user_id,
          user_id: person.user_id,
          name: person.name,
          amount: person.amount,
          reason: 'Various expenses', // API doesn't provide reason, use default
          avatar_url: null, // API doesn't provide avatar
        })),
        peopleWhoOweYou: (data.people_who_owe_you || []).map((person) => ({
          id: person.user_id,
          user_id: person.user_id,
          name: person.name,
          amount: person.amount,
          reason: 'Various expenses', // API doesn't provide reason, use default
          avatar_url: null, // API doesn't provide avatar
        })),
        otherBalances: [], // API doesn't provide other balances, leave empty
      };
      
      setBalances(transformedBalances);
    } catch (err) {
      setError(err.message);
      toast.error('Failed to load balances', {
        description: err.message || 'Please check if the backend is running',
      });
      // Set default empty balances on error
      setBalances({
        yourBalance: 0,
        youOwe: 0,
        youAreOwed: 0,
        peopleYouOwe: [],
        peopleWhoOweYou: [],
        otherBalances: [],
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount and when groupId changes
  useEffect(() => {
    fetchBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  // Refresh balances when refresh trigger changes (e.g., after adding expense)
  useEffect(() => {
    if (onRefresh && onRefresh > 0) {
      fetchBalances();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRefresh]);

  if (loading || !balances) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Skeleton className="h-1.5 w-full" />
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  const isNegative = balances.yourBalance < 0;
  const isPositive = balances.yourBalance > 0;
  const isSettled = balances.yourBalance === 0;

  const handleSettleUp = () => {
    // Open settlements modal to show suggestions
    setSettlementsModalOpen(true);
  };

  const handleSettlementRecorded = async (updatedBalances) => {
    // Backend returns raw balances object: { user_A: 0.0, user_B: 0.0, ... }
    // We need to refetch to get proper format with people_you_owe, people_who_owe_you, etc.
    // Await ensures state updates before next render
    await fetchBalances();
    
    // Also notify parent to refresh group stats if needed
    if (onRefresh) {
      onRefresh();
    }
  };

  const totalInvolved = balances.youOwe + balances.youAreOwed;
  const owePercentage = totalInvolved > 0 ? (balances.youOwe / totalInvolved) * 100 : 50;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column - Your Total Balance */}
      <Card className="overflow-hidden">
        {/* Balance indicator bar */}
        <div
          className="h-1.5"
          style={{
            backgroundColor: isNegative
              ? 'hsl(0, 84%, 60%)'
              : isPositive
              ? 'hsl(168, 58%, 44%)'
              : 'hsl(var(--muted-foreground))',
          }}
        />

        <CardContent className="p-6">
          <p className="text-xs uppercase text-muted-foreground tracking-wider mb-2">
            Your Total Balance
          </p>
          <p
            className="text-4xl font-bold"
            style={{
              color: isNegative
                ? 'hsl(0, 84%, 60%)'
                : isPositive
                ? 'hsl(168, 58%, 44%)'
                : 'inherit',
            }}
          >
            {isNegative ? '-' : isPositive ? '+' : ''} ₹
            {Math.abs(balances.yourBalance).toFixed(2)}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {isSettled
              ? "You're all settled up in this group!"
              : isNegative
              ? `You owe ₹${balances.youOwe.toLocaleString()} in total, but you are owed ₹${balances.youAreOwed} back.`
              : `You are owed ₹${balances.youAreOwed.toLocaleString()} in total.`}
          </p>

          {/* Progress bar */}
          {!isSettled && totalInvolved > 0 && (
            <div className="mt-6">
              <div className="h-3 rounded-full overflow-hidden flex bg-muted">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${owePercentage}%`,
                    backgroundColor: 'hsl(0, 84%, 60%)',
                  }}
                />
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${100 - owePercentage}%`,
                    backgroundColor: 'hsl(168, 58%, 44%)',
                  }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>Owe {Math.round(owePercentage)}%</span>
                <span>Get {Math.round(100 - owePercentage)}%</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right Column - Balance Details */}
      <div className="space-y-6">
        {/* People You Owe */}
        {balances.peopleYouOwe.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ArrowUpRight className="w-4 h-4 text-destructive" />
              <span className="text-xs uppercase text-muted-foreground tracking-wider font-semibold">
                People You Owe
              </span>
            </div>
            <div className="space-y-3">
              {balances.peopleYouOwe.map((person) => (
                <Card key={person.id}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={person.avatar_url} />
                      <AvatarFallback className="bg-red-50 text-red-600">
                        {person.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{person.name}</p>
                      <p className="text-sm text-muted-foreground">For: {person.reason}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-destructive">
                        ₹{person.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">You owe</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* People Who Owe You */}
        {balances.peopleWhoOweYou.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ArrowDownLeft className="w-4 h-4" style={{ color: 'hsl(168, 58%, 44%)' }} />
              <span className="text-xs uppercase text-muted-foreground tracking-wider font-semibold">
                People Who Owe You
              </span>
            </div>
            <div className="space-y-3">
              {balances.peopleWhoOweYou.map((person) => (
                <Card key={person.id}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={person.avatar_url} />
                      <AvatarFallback
                        style={{ backgroundColor: 'hsl(168, 45%, 92%)', color: 'hsl(168, 58%, 44%)' }}
                      >
                        {person.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{person.name}</p>
                      <p className="text-sm text-muted-foreground">For: {person.reason}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold" style={{ color: 'hsl(168, 58%, 44%)' }}>
                        ₹{person.amount}
                      </p>
                      <Button
                        variant="link"
                        className="p-0 h-auto text-sm"
                        style={{ color: 'hsl(168, 58%, 44%)' }}
                        onClick={handleSettleUp}
                      >
                        Mark received
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Other Group Balances */}
        {balances.otherBalances.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs uppercase text-muted-foreground tracking-wider font-semibold">
                Other Group Balances
              </span>
            </div>
            <div className="space-y-3">
              {balances.otherBalances.map((balance, index) => (
                <Card key={index}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex -space-x-2">
                      <Avatar className="w-10 h-10 border-2 border-card">
                        <AvatarFallback className="bg-muted">{balance.from.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <Avatar className="w-10 h-10 border-2 border-card">
                        <AvatarFallback className="bg-muted">{balance.to.charAt(0)}</AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">
                        {balance.from} <span className="text-muted-foreground">owes</span> {balance.to}
                      </p>
                    </div>
                    <p className="font-bold">₹{balance.amount}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {balances.peopleYouOwe.length === 0 &&
          balances.peopleWhoOweYou.length === 0 &&
          balances.otherBalances.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: 'hsl(168, 45%, 92%)' }}
                >
                  <Users className="w-8 h-8" style={{ color: 'hsl(168, 58%, 44%)' }} />
                </div>
                <p className="text-lg font-medium text-foreground mb-1">All settled up!</p>
                <p className="text-muted-foreground">No outstanding balances in this group.</p>
              </CardContent>
            </Card>
          )}
      </div>

      {/* Settlements Modal */}
      <SettlementsModal
        open={settlementsModalOpen}
        onOpenChange={setSettlementsModalOpen}
        groupId={groupId}
        currentUserId={group?.members?.[0]?.user_id}
        onSettlementRecorded={handleSettlementRecorded}
      />
    </div>
  );
}
