import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  MoreHorizontal,
  Utensils,
  Home,
  Car,
  ShoppingBag,
  Zap,
  Edit2,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { categoryConfig } from '@/lib/mock-data';
import { getGroupExpenses, deleteExpense } from '@/services/api';
import { toast } from 'sonner';
import AddExpenseModal from '@/components/modals/AddExpenseModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const categoryIcons = {
  Food: Utensils,
  Rent: Home,
  Travel: Car,
  Groceries: ShoppingBag,
  Utilities: Zap,
  Stay: Home,
  Entertainment: Zap,
};

// Map API category to display category (if needed)
const normalizeCategory = (category) => {
  // API might return different category names, normalize if needed
  return category || 'Other';
};

export default function ExpensesTab({ groupId, group, onRefreshBalances }) {
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch expenses from API
  useEffect(() => {
    const fetchExpenses = async () => {
      if (!groupId) return;

      try {
        setLoading(true);
        setError(null);
        const data = await getGroupExpenses(groupId);
        
        // Transform API response to match component expectations
        // API returns: { id, title, amount, paid_by (user_id), paid_by_name, category, split_type, date, splits }
        // Component expects: { id, title, amount, category, paidBy: {id, name}, splitType, date, color }
        const transformedExpenses = data.map((expense) => {
          // Get color from category config or default
          const catConfig = categoryConfig[expense.category] || categoryConfig.Other;
          
          // Format date for display
          const expenseDate = expense.date 
            ? new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : 'Unknown';

          return {
            id: expense.id,
            title: expense.title,
            amount: expense.amount,
            category: normalizeCategory(expense.category),
            paidBy: {
              id: expense.paid_by,
              name: expense.paid_by_name || 'Unknown',
            },
            splitType: expense.split_type === 'equal' ? 'Split equally' : expense.split_type,
            date: expenseDate,
            color: catConfig.color,
          };
        });
        
        setExpenses(transformedExpenses);
      } catch (err) {
        setError(err.message);
        toast.error('Failed to load expenses', {
          description: err.message || 'Please check if the backend is running',
        });
        setExpenses([]);
      } finally {
        setLoading(false);
      }
    };

    fetchExpenses();
  }, [groupId]);

  // Refresh expenses list (called after adding expense)
  const refreshExpenses = async () => {
    if (!groupId) return;

    try {
      const data = await getGroupExpenses(groupId);
      const transformedExpenses = data.map((expense) => {
        const catConfig = categoryConfig[expense.category] || categoryConfig.Other;
        const expenseDate = expense.date 
          ? new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : 'Unknown';

        return {
          id: expense.id,
          title: expense.title,
          amount: expense.amount,
          category: normalizeCategory(expense.category),
          paidBy: {
            id: expense.paid_by,
            name: expense.paid_by_name || 'Unknown',
          },
          splitType: expense.split_type === 'equal' ? 'Split equally' : expense.split_type,
          date: expenseDate,
          color: catConfig.color,
        };
      });
      setExpenses(transformedExpenses);
      
      // Trigger balances refresh via callback (if provided)
      if (onRefreshBalances) {
        onRefreshBalances();
      }
    } catch (err) {
      toast.error('Failed to refresh expenses', {
        description: err.message || 'Please try again',
      });
    }
  };

  // Extract unique categories from expenses
  const categories = ['all', ...new Set(expenses.map((e) => e.category))];

  // Filter expenses by category
  const filteredExpenses =
    selectedCategory === 'all'
      ? expenses
      : expenses.filter((e) => e.category === selectedCategory);

  const handleEdit = (expense) => {
    toast.info('Edit expense', { description: `Editing "${expense.title}"` });
  };

  const handleDelete = async (expense) => {
    try {
      // Delete expense via API
      await deleteExpense(groupId, expense.id);
      
      toast.success('Expense deleted', { description: `"${expense.title}" was removed` });
      
      // Refetch expenses to update UI
      await refreshExpenses();
    } catch (err) {
      toast.error('Failed to delete expense', {
        description: err.message || 'Please try again',
      });
    }
  };

  return (
    <div className="space-y-6 relative pb-20">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              className={cn(selectedCategory === cat && 'border-0')}
              style={
                selectedCategory === cat
                  ? { backgroundColor: 'hsl(168, 58%, 44%)' }
                  : {}
              }
            >
              {cat === 'all' ? 'All' : cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Expenses List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            // Loading state: Show skeleton items
            <div className="divide-y">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <div className="text-right space-y-2">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredExpenses.length > 0 ? (
            <div className="divide-y">
              {filteredExpenses.map((expense, index) => {
                const CategoryIcon = categoryIcons[expense.category] || Utensils;
                const catConfig = categoryConfig[expense.category] || categoryConfig.Other;

                return (
                  <div
                    key={expense.id}
                    className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors group animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* Category Icon */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${expense.color}15` }}
                    >
                      <CategoryIcon className="w-5 h-5" style={{ color: expense.color }} />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-foreground">{expense.title}</h3>
                        <Badge
                          variant="secondary"
                          className={cn('text-xs', catConfig.bgColor, catConfig.textColor)}
                        >
                          {expense.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Paid by {expense.paidBy.name} • {expense.splitType}
                      </p>
                    </div>

                    {/* Amount & Date */}
                    <div className="text-right flex-shrink-0">
                      <p className="font-semibold text-foreground">
                        ₹{expense.amount.toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">{expense.date}</p>
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(expense)}>
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(expense)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                <Utensils className="w-8 h-8" style={{ color: 'hsl(168, 58%, 44%)' }} />
              </div>
              <p className="text-lg font-medium text-foreground mb-1">No expenses yet</p>
              <p className="text-muted-foreground mb-4">
                Add your first expense to start tracking
              </p>
              <Button
                onClick={() => setAddExpenseOpen(true)}
                style={{ backgroundColor: 'hsl(168, 58%, 44%)' }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Expense
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sticky Add Button */}
      {filteredExpenses.length > 0 && (
        <div className="sticky bottom-6 flex justify-end mt-6">
          <Button
            className="h-14 px-6 rounded-full shadow-lg gap-2 hover:shadow-xl transition-shadow"
            style={{ backgroundColor: 'hsl(168, 58%, 44%)' }}
            onClick={() => setAddExpenseOpen(true)}
          >
            <Plus className="w-5 h-5" />
            Add Expense
          </Button>
        </div>
      )}

      {/* Add Expense Modal */}
      <AddExpenseModal
        open={addExpenseOpen}
        onOpenChange={setAddExpenseOpen}
        groupId={groupId}
        members={group?.members || []}
        onSuccess={refreshExpenses}
      />
    </div>
  );
}
