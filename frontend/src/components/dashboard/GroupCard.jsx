import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Home, Plane, Heart, Users, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const typeIcons = {
  home: Home,
  trip: Plane,
  couple: Heart,
  other: Users,
};

const typeColors = {
  home: '#2AB3A4',
  trip: '#3B82F6',
  couple: '#EC4899',
  other: '#8B5CF6',
};

export default function GroupCard({ group, style }) {
  const TypeIcon = typeIcons[group.type] || Users;
  const accentColor = typeColors[group.type] || '#2AB3A4';

  // Calculate balance status
  const getBalanceInfo = () => {
    const balance = group.balances?.yourBalance || 0;
    if (balance < 0) {
      return {
        type: 'owe',
        text: `You owe ₹${Math.abs(balance).toLocaleString()}`,
        color: 'text-destructive',
      };
    } else if (balance > 0) {
      return {
        type: 'owed',
        text: `You are owed ₹${balance.toLocaleString()}`,
        color: 'text-emerald-600',
      };
    }
    return {
      type: 'settled',
      text: 'All settled up',
      color: 'text-muted-foreground',
    };
  };

  const balanceInfo = getBalanceInfo();
  const budgetPercentage = group.budget_percent || 0;
  const hasBudgets = budgetPercentage > 0 || (group.budget_percent !== undefined && group.budget_percent !== null);

  return (
    <Card
      className="overflow-hidden card-hover border-border/50 animate-fade-in flex flex-col h-full"
      style={style}
    >
      {/* Accent bar */}
      <div className="h-1" style={{ backgroundColor: accentColor }} />

      <div className="p-6 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${accentColor}15` }}
          >
            <TypeIcon className="w-5 h-5" style={{ color: accentColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{group.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">
                {group.memberCount} members
              </span>
              <div className="flex -space-x-2">
                {group.members.slice(0, 3).map((member) => (
                  <Avatar key={member.id} className="w-6 h-6 border-2 border-card">
                    <AvatarImage src={member.avatar_url} />
                    <AvatarFallback className="text-xs bg-muted">
                      {member.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {group.memberCount > 3 && (
                  <div className="w-6 h-6 rounded-full bg-muted border-2 border-card flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">
                      +{group.memberCount - 3}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Balance */}
        <div className="mb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Your balance</p>
          <span className={cn('text-sm font-semibold', balanceInfo.color)}>
            {balanceInfo.text}
          </span>
        </div>

        {/* Budget Progress - Only show if budgets exist */}
        {budgetPercentage > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Budget used</span>
              <span className="text-xs font-semibold">{Math.round(budgetPercentage)}%</span>
            </div>
            <div className="relative h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(budgetPercentage, 100)}%`,
                  backgroundColor:
                    budgetPercentage >= 90
                      ? '#EF4444'
                      : budgetPercentage >= 75
                      ? '#F59E0B'
                      : '#2AB3A4',
                }}
              />
            </div>
          </div>
        )}

        {/* Action - pushed to bottom with mt-auto */}
        <Link to={`/dashboard/groups/${group.id}`} className="mt-auto">
          <Button variant="outline" size="sm" className="w-full group">
            View details
            <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
          </Button>
        </Link>
      </div>
    </Card>
  );
}
