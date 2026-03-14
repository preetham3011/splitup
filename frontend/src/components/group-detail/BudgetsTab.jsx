import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  ShoppingCart,
  Home,
  PartyPopper,
  Zap,
  Plane,
  Utensils,
  MoreHorizontal,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Wallet,
  Edit,
  Trash2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  getGroupBudgets,
  createOrUpdateBudget,
  updateBudget,
  deleteBudget,
} from '@/services/api';

const iconMap = {
  'shopping-cart': ShoppingCart,
  home: Home,
  party: PartyPopper,
  zap: Zap,
  plane: Plane,
  utensils: Utensils,
};

// Map category names to icons
const getCategoryIcon = (categoryName) => {
  const name = categoryName?.toLowerCase() || '';
  if (name.includes('food') || name.includes('restaurant') || name.includes('dining')) {
    return 'utensils';
  }
  if (name.includes('shopping') || name.includes('store')) {
    return 'shopping-cart';
  }
  if (name.includes('travel') || name.includes('trip')) {
    return 'plane';
  }
  if (name.includes('home') || name.includes('house')) {
    return 'home';
  }
  if (name.includes('party') || name.includes('event')) {
    return 'party';
  }
  return 'shopping-cart'; // default
};

const statusConfig = {
  safe: { label: 'Safe', color: 'text-emerald-600', bgColor: 'bg-emerald-500' },
  'limit-reached': { label: 'Limit Reached', color: 'text-red-500', bgColor: 'bg-red-500' },
  'nearing-limit': { label: 'Nearing Limit', color: 'text-amber-500', bgColor: 'bg-amber-500' },
  'on-track': { label: 'On Track', color: 'hsl(168, 58%, 44%)', bgColor: 'bg-primary' },
};

const chartColors = ['#2AB3A4', '#EF4444', '#3B82F6', '#F59E0B', '#8B5CF6'];

// Calculate status based on percentage used
const getStatus = (percentageUsed) => {
  if (percentageUsed >= 100) return 'limit-reached';
  if (percentageUsed >= 80) return 'nearing-limit';
  if (percentageUsed >= 50) return 'on-track';
  return 'safe';
};

export default function BudgetsTab({ group }) {
  const [filter, setFilter] = useState('all');
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [categoryName, setCategoryName] = useState('');
  const [limit, setLimit] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingBudgetId, setDeletingBudgetId] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [budgetToDelete, setBudgetToDelete] = useState(null);

  const groupId = group?.id;

  // Fetch budgets when component mounts or groupId changes
  useEffect(() => {
    const fetchBudgets = async () => {
      if (!groupId) return;

      try {
        setLoading(true);
        setError(null);
        const data = await getGroupBudgets(groupId);
        setBudgets(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || 'Failed to load budgets');
        toast.error('Failed to load budgets', {
          description: err.message || 'Please check if the backend is running',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBudgets();
  }, [groupId]);

  // Transform backend budgets to UI format
  const transformedBudgets = budgets.map((budget) => {
    const category = budget.category || 'Other';
    const limitValue = parseFloat(budget.limit || 0);
    const spentValue = parseFloat(budget.spent || 0);
    const remainingValue = parseFloat(budget.remaining || 0);
    const percentageUsed = parseFloat(budget.percentage_used || 0);

    return {
      id: budget.id,
      name: category,
      category: category,
      limit: limitValue,
      spent: spentValue,
      remaining: remainingValue,
      percentageUsed: percentageUsed,
      status: getStatus(percentageUsed),
      icon: getCategoryIcon(category),
    };
  });

  // Calculate totals
  const totalBudget = transformedBudgets.reduce((sum, b) => sum + (b.limit || 0), 0);
  const totalSpent = transformedBudgets.reduce((sum, b) => sum + (b.spent || 0), 0);
  const remaining = transformedBudgets.reduce((sum, b) => sum + (b.remaining || 0), 0);
  const percentageUsed = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  const filteredCategories = transformedBudgets.filter((cat) => {
    if (!cat) return false;
    if (filter === 'all') return true;
    if (filter === 'over') return cat.status === 'limit-reached' || cat.status === 'nearing-limit';
    return cat.status === 'safe' || cat.status === 'on-track';
  });

  // Handle create budget
  const handleCreateBudget = async () => {
    if (!categoryName.trim() || !limit || parseFloat(limit) <= 0) {
      toast.error('Please enter a valid category name and limit');
      return;
    }

    setIsSaving(true);
    try {
      await createOrUpdateBudget(groupId, {
        category: categoryName.trim(),
        limit: parseFloat(limit),
      });

      toast.success('Budget created successfully!');
      setCreateModalOpen(false);
      setCategoryName('');
      setLimit('');

      // Refresh budgets
      const data = await getGroupBudgets(groupId);
      setBudgets(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error('Failed to create budget', {
        description: err.message || 'Please try again',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle edit budget
  const handleEditBudget = (budget) => {
    setEditingBudget(budget);
    setCategoryName(budget.category || '');
    setLimit(budget.limit?.toString() || '');
    setEditModalOpen(true);
  };

  const handleUpdateBudget = async () => {
    if (!editingBudget || !categoryName.trim() || !limit || parseFloat(limit) <= 0) {
      toast.error('Please enter a valid category name and limit');
      return;
    }

    setIsSaving(true);
    try {
      await updateBudget(editingBudget.id, {
        category: categoryName.trim(),
        limit: parseFloat(limit),
      });

      toast.success('Budget updated successfully!');
      setEditModalOpen(false);
      setEditingBudget(null);
      setCategoryName('');
      setLimit('');

      // Refresh budgets
      const data = await getGroupBudgets(groupId);
      setBudgets(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error('Failed to update budget', {
        description: err.message || 'Please try again',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete budget - show modal
  const handleDeleteBudget = (budget) => {
    setBudgetToDelete(budget);
    setDeleteModalOpen(true);
  };

  // Confirm delete budget
  const confirmDeleteBudget = async () => {
    if (!budgetToDelete) return;

    setDeletingBudgetId(budgetToDelete.id);
    try {
      await deleteBudget(budgetToDelete.id);
      toast.success('Budget deleted successfully!');

      // Refresh budgets
      const data = await getGroupBudgets(groupId);
      setBudgets(Array.isArray(data) ? data : []);
      setDeleteModalOpen(false);
      setBudgetToDelete(null);
    } catch (err) {
      toast.error('Failed to delete budget', {
        description: err.message || 'Please try again',
      });
    } finally {
      setDeletingBudgetId(null);
    }
  };

  // Reset form when modals close
  useEffect(() => {
    if (!createModalOpen && !editModalOpen) {
      setCategoryName('');
      setLimit('');
      setEditingBudget(null);
    }
  }, [createModalOpen, editModalOpen]);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Group Budgets</h2>
            <p className="text-muted-foreground text-sm">Track spending limits and shared costs</p>
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Error state
  if (error && budgets.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Group Budgets</h2>
            <p className="text-muted-foreground text-sm">Track spending limits and shared costs</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-12">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <AlertTriangle className="w-12 h-12 text-red-500" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Failed to load budgets</h3>
                <p className="text-muted-foreground text-sm">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Empty state
  if (budgets.length === 0) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Group Budgets</h2>
            <p className="text-muted-foreground text-sm">Track spending limits and shared costs</p>
          </div>
          <Button
            className="gap-2"
            style={{ backgroundColor: 'hsl(168, 58%, 44%)' }}
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Set New Budget
          </Button>
        </div>

        {/* Empty State */}
        <Card>
          <CardContent className="p-12">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'hsl(168, 45%, 92%)' }}
              >
                <Wallet className="w-8 h-8" style={{ color: 'hsl(168, 58%, 44%)' }} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">No budgets set yet</h3>
                <p className="text-muted-foreground text-sm max-w-md">
                  Budgets help you track monthly spending limits and stay on top of shared costs.
                  Set category-based budgets to monitor your group's expenses and avoid overspending.
                </p>
              </div>
              <Button
                className="gap-2 mt-4"
                style={{ backgroundColor: 'hsl(168, 58%, 44%)' }}
                onClick={() => setCreateModalOpen(true)}
              >
                <Plus className="w-4 h-4" />
                Set Your First Budget
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Create Budget Modal */}
        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">Create Budget</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Set a spending limit for a category
              </p>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label className="text-sm font-medium">Category Name</Label>
                <Input
                  placeholder="e.g. Food, Shopping, Travel"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Limit (₹)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 5000"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className="mt-1.5"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  style={{ backgroundColor: 'hsl(168, 58%, 44%)' }}
                  onClick={handleCreateBudget}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Budget'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Group Budgets</h2>
          <p className="text-muted-foreground text-sm">Track spending limits and shared costs</p>
        </div>
        <Button
          className="gap-2"
          style={{ backgroundColor: 'hsl(168, 58%, 44%)' }}
          onClick={() => setCreateModalOpen(true)}
        >
          <Plus className="w-4 h-4" />
          Set New Budget
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Stats & Categories */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Total Budget</p>
                <p className="text-2xl font-bold">₹{totalBudget.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">For all categories</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Total Spent</p>
                <p className="text-2xl font-bold">₹{totalSpent.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Updated just now</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Remaining</p>
                <p className="text-2xl font-bold" style={{ color: 'hsl(168, 58%, 44%)' }}>
                  ₹{remaining.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">{percentageUsed}% of budget used</p>
              </CardContent>
            </Card>
          </div>

          {/* Category Breakdown */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Category Breakdown</h3>
                <div className="flex gap-2">
                  {['all', 'over', 'safe'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={cn(
                        'px-3 py-1 text-sm rounded-md transition-colors',
                        filter === f
                          ? 'bg-muted font-medium'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {f === 'all' ? 'All' : f === 'over' ? 'Over Budget' : 'Safe'}
                    </button>
                  ))}
                </div>
              </div>

              {filteredCategories.length > 0 ? (
                <div className="space-y-4">
                  {filteredCategories.map((category, index) => {
                    if (!category) return null;
                    const Icon = iconMap[category.icon] || ShoppingCart;
                    const status = statusConfig[category.status] || statusConfig.safe;
                    const categorySpent = category.spent ?? 0;
                    const categoryLimit = category.limit ?? 0;
                    const percentage = categoryLimit > 0 ? Math.round((categorySpent / categoryLimit) * 100) : 0;
                    const isDeleting = deletingBudgetId === category.id;

                    return (
                      <div
                        key={category.id}
                        className="p-4 border rounded-xl animate-fade-in"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                'w-10 h-10 rounded-lg flex items-center justify-center',
                                category.status === 'limit-reached'
                                  ? 'bg-red-50 text-red-500'
                                  : category.status === 'nearing-limit'
                                  ? 'bg-amber-50 text-amber-500'
                                  : 'text-primary'
                              )}
                              style={
                                category.status !== 'limit-reached' && category.status !== 'nearing-limit'
                                  ? { backgroundColor: 'hsl(168, 45%, 92%)', color: 'hsl(168, 58%, 44%)' }
                                  : {}
                              }
                            >
                              <Icon className="w-5 h-5" />
                            </div>
                            <span className="font-medium">{category.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={cn('text-sm font-medium', status.color)}
                              style={
                                category.status === 'on-track' || category.status === 'safe'
                                  ? { color: 'hsl(168, 58%, 44%)' }
                                  : {}
                              }
                            >
                              {status.label}
                            </span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="text-muted-foreground hover:text-foreground">
                                  <MoreHorizontal className="w-5 h-5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditBudget(category)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteBudget(category)}
                                  disabled={isDeleting}
                                  className="text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="h-2 rounded-full bg-muted mb-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(percentage, 100)}%`,
                              backgroundColor:
                                category.status === 'limit-reached'
                                  ? '#EF4444'
                                  : category.status === 'nearing-limit'
                                  ? '#F59E0B'
                                  : '#2AB3A4',
                            }}
                          />
                        </div>

                        <div className="flex justify-between text-sm">
                          <span
                            className={cn(
                              category.status === 'limit-reached' ? 'text-red-500' : 'text-muted-foreground'
                            )}
                          >
                            ₹{categorySpent.toLocaleString()} spent
                          </span>
                          <span className="text-muted-foreground">
                            ₹{categoryLimit.toLocaleString()} limit
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No categories match this filter.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Chart & Alerts */}
        <div className="space-y-6">
          {/* Spending Analysis Chart */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Spending Analysis</h3>

              {/* Donut Chart */}
              {transformedBudgets.length > 0 && totalSpent > 0 ? (
                <>
                  <div className="relative w-48 h-48 mx-auto mb-6">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      {transformedBudgets.map((cat, index) => {
                        if (!cat) return null;
                        const catSpent = cat.spent ?? 0;
                        const percentage = totalSpent > 0 ? (catSpent / totalSpent) * 100 : 0;
                        const offset = transformedBudgets
                          .slice(0, index)
                          .reduce((acc, c) => {
                            const cSpent = c?.spent ?? 0;
                            return acc + (totalSpent > 0 ? (cSpent / totalSpent) * 100 : 0);
                          }, 0);
                        const circumference = 2 * Math.PI * 40;
                        const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
                        const strokeDashoffset = -(offset / 100) * circumference;

                        return (
                          <circle
                            key={cat.id || index}
                            cx="50"
                            cy="50"
                            r="40"
                            fill="none"
                            stroke={chartColors[index % chartColors.length]}
                            strokeWidth="16"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            className="transition-all duration-500"
                          />
                        );
                      })}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xs text-muted-foreground">TOTAL</span>
                      <span className="text-xl font-bold">
                        ₹{(totalSpent / 1000).toFixed(1)}k
                      </span>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="grid grid-cols-2 gap-2">
                    {transformedBudgets.slice(0, 4).map((cat, index) => {
                      if (!cat) return null;
                      return (
                        <div key={cat.id || index} className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: chartColors[index % chartColors.length] }}
                          />
                          <span className="text-xs text-muted-foreground truncate">
                            {cat.name?.split(' ')[0] || 'Category'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground text-sm">No budget data available.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alerts */}
          {transformedBudgets.some((c) => c?.status === 'limit-reached') && (
            <div className="bg-red-50 rounded-xl border border-red-200 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-red-600">Critical Alert</p>
                  <p className="text-sm text-red-600">
                    You have hit 100% of your budget limit in one or more categories.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Saving Tip */}
          <div
            className="rounded-xl border p-4"
            style={{ backgroundColor: 'hsl(168, 45%, 92%)', borderColor: 'hsl(168, 58%, 44%, 0.2)' }}
          >
            <div className="flex items-start gap-3">
              <TrendingDown className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'hsl(168, 58%, 44%)' }} />
              <div>
                <p className="font-semibold" style={{ color: 'hsl(168, 58%, 44%)' }}>
                  Saving Tip
                </p>
                <p className="text-sm" style={{ color: 'hsl(168, 58%, 38%)' }}>
                  Track your spending to stay within budget limits.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Budget Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Create Budget</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Set a spending limit for a category
            </p>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium">Category Name</Label>
              <Input
                placeholder="e.g. Food, Shopping, Travel"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Limit (₹)</Label>
              <Input
                type="number"
                placeholder="e.g. 5000"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="mt-1.5"
                min="0"
                step="0.01"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setCreateModalOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                style={{ backgroundColor: 'hsl(168, 58%, 44%)' }}
                onClick={handleCreateBudget}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Budget'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Budget Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Edit Budget</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Update the spending limit for this category
            </p>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium">Category Name</Label>
              <Input
                placeholder="e.g. Food, Shopping, Travel"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Limit (₹)</Label>
              <Input
                type="number"
                placeholder="e.g. 5000"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="mt-1.5"
                min="0"
                step="0.01"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setEditModalOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                style={{ backgroundColor: 'hsl(168, 58%, 44%)' }}
                onClick={handleUpdateBudget}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Budget'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Budget Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Budget</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete the budget for "{budgetToDelete?.name}"? This action cannot be undone.
            </p>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteModalOpen(false);
                setBudgetToDelete(null);
              }}
              disabled={deletingBudgetId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteBudget}
              disabled={deletingBudgetId !== null}
            >
              {deletingBudgetId === budgetToDelete?.id ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Budget'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
