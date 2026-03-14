import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  Check,
  Utensils,
  ShoppingBag,
  Car,
  Zap,
  Home,
  MoreHorizontal,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { addExpense } from '@/services/api';

const categories = [
  { id: 'food', label: 'Food', icon: Utensils },
  { id: 'groceries', label: 'Groceries', icon: ShoppingBag },
  { id: 'transport', label: 'Transport', icon: Car },
  { id: 'utilities', label: 'Utilities', icon: Zap },
  { id: 'rent', label: 'Rent', icon: Home },
  { id: 'other', label: 'More', icon: MoreHorizontal },
];

// Map category ID to display name for API
const categoryMap = {
  food: 'Food',
  groceries: 'Groceries',
  transport: 'Travel',
  utilities: 'Utilities',
  rent: 'Rent',
  other: 'Other',
};

export default function AddExpenseModal({ open, onOpenChange, groupId, members, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('food');
  const [splitType, setSplitType] = useState('equal');
  const [selectedPayer, setSelectedPayer] = useState(members[0]?.id || members[0]?.user_id || '');
  const [selectedMembers, setSelectedMembers] = useState(
    members.map((m) => m.id || m.user_id).filter(Boolean)
  );
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);
  
  const [memberAmounts, setMemberAmounts] = useState({});
  const [memberPercentages, setMemberPercentages] = useState({});
  const [validationError, setValidationError] = useState('');

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open && members.length > 0) {
      const firstMemberId = members[0]?.id || members[0]?.user_id;
      setSelectedPayer(firstMemberId || '');
      const allMemberIds = members.map((m) => m.id || m.user_id).filter(Boolean);
      setSelectedMembers(allMemberIds);
      setMemberAmounts({});
      setMemberPercentages({});
      setValidationError('');
    } else if (!open) {
      setAmount('');
      setDescription('');
      setSelectedCategory('food');
      setSplitType('equal');
      setExpenseDate(new Date().toISOString().split('T')[0]);
      setIsSaving(false);
      setMemberAmounts({});
      setMemberPercentages({});
      setValidationError('');
    }
  }, [open, members]);

  const parsedAmount = parseFloat(amount) || 0;

  const toggleMember = (memberId) => {
    setSelectedMembers((prev) => {
      return prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId];
    });
  };

  const getMemberAmount = (memberId) => {
    if (splitType === 'equal') {
      return selectedMembers.length > 0 ? parsedAmount / selectedMembers.length : 0;
    } else if (splitType === 'exact') {
      return parseFloat(memberAmounts[memberId]) || 0;
    } else if (splitType === 'percentage') {
      const percent = parseFloat(memberPercentages[memberId]) || 0;
      return (parsedAmount * percent) / 100;
    }
    return 0;
  };

  const validateSplit = () => {
    setValidationError('');
    
    if (selectedMembers.length === 0) {
      return 'Please select at least one member';
    }

    if (splitType === 'exact') {
      const total = selectedMembers.reduce((sum, id) => {
        return sum + (parseFloat(memberAmounts[id]) || 0);
      }, 0);
      const diff = Math.abs(total - parsedAmount);
      if (diff > 0.01) {
        return `Split amounts must equal ₹${parsedAmount.toFixed(2)} (current: ₹${total.toFixed(2)})`;
      }
    } else if (splitType === 'percentage') {
      const totalPercent = selectedMembers.reduce((sum, id) => {
        return sum + (parseFloat(memberPercentages[id]) || 0);
      }, 0);
      const diff = Math.abs(totalPercent - 100);
      if (diff > 0.01) {
        return `Percentages must sum to 100% (current: ${totalPercent.toFixed(2)}%)`;
      }
    }
    
    return '';
  };

  const handleSave = async () => {
    if (!amount || !description || !groupId) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (parsedAmount <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }

    if (!selectedPayer) {
      toast.error('Please select who paid');
      return;
    }

    const error = validateSplit();
    if (error) {
      setValidationError(error);
      toast.error(error);
      return;
    }

    setIsSaving(true);

    try {
      const payerMember = members.find((m) => (m.id || m.user_id) === selectedPayer);
      const payerUserId = payerMember?.user_id || payerMember?.id || selectedPayer;

      const dateForAPI = expenseDate 
        ? new Date(expenseDate + 'T00:00:00').toISOString()
        : new Date().toISOString();

      let splitPayload = null;
      
      if (splitType === 'equal') {
        splitPayload = {
          type: 'equal',
          participants: selectedMembers.map(memberId => {
            const member = members.find(m => (m.id || m.user_id) === memberId);
            return member?.user_id || member?.id || memberId;
          })
        };
      } else if (splitType === 'exact') {
        splitPayload = {
          type: 'exact',
          participants: selectedMembers.map(memberId => {
            const member = members.find(m => (m.id || m.user_id) === memberId);
            const userId = member?.user_id || member?.id || memberId;
            return {
              user_id: userId,
              amount: getMemberAmount(memberId)
            };
          })
        };
      } else if (splitType === 'percentage') {
        splitPayload = {
          type: 'percentage',
          participants: selectedMembers.map(memberId => {
            const member = members.find(m => (m.id || m.user_id) === memberId);
            const userId = member?.user_id || member?.id || memberId;
            const percent = parseFloat(memberPercentages[memberId]) || 0;
            return {
              user_id: userId,
              percent: percent
            };
          })
        };
      }

      await addExpense(groupId, {
        title: description.trim(),
        amount: parsedAmount,
        paid_by: payerUserId,
        category: categoryMap[selectedCategory] || 'Other',
        split_type: splitType,
        split: splitPayload,
        date: dateForAPI,
      });

      const splitDesc = splitType === 'equal' 
        ? `split equally among ${selectedMembers.length} members`
        : splitType === 'exact'
        ? 'split by exact amounts'
        : 'split by percentages';
      
      toast.success('Expense added!', {
        description: `₹${parsedAmount.toLocaleString()} ${splitDesc}`,
      });

      onOpenChange(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      toast.error('Failed to add expense', {
        description: error.message || 'Please try again',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Find payer member (handle both id and user_id fields)
  const payer = members.find((m) => (m.id || m.user_id) === selectedPayer);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b" style={{ backgroundColor: 'hsl(180, 20%, 98%)' }}>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'hsl(168, 58%, 44%)' }}
          >
            <Wallet className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-lg font-semibold">Add New Expense</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
          {/* Left Side - Amount & Details */}
          <div className="p-6 space-y-6">
            {/* Amount */}
            <div>
              <Label className="text-xs uppercase text-muted-foreground tracking-wider mb-3 block">
                Total Amount
              </Label>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl text-muted-foreground/60 font-medium">₹</span>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="text-5xl font-semibold border-none shadow-none p-0 h-auto focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-muted-foreground/40"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <Label className="text-sm font-medium">Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this for?"
                className="mt-1.5"
              />
            </div>

            {/* Category */}
            <div>
              <Label className="text-sm font-medium">Category</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {categories.map((category) => {
                  const Icon = category.icon;
                  const isSelected = selectedCategory === category.id;
                  return (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={cn(
                        'py-2.5 px-3 rounded-xl border text-sm font-medium transition-all flex flex-col items-center gap-1.5',
                        isSelected
                          ? 'border-2'
                          : 'border-border hover:border-muted-foreground/50'
                      )}
                      style={
                        isSelected
                          ? {
                              borderColor: 'hsl(168, 58%, 44%)',
                              backgroundColor: 'hsl(168, 45%, 92%)',
                              color: 'hsl(168, 58%, 44%)',
                            }
                          : {}
                      }
                    >
                      <Icon className="w-4 h-4" />
                      {category.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date */}
            <div>
              <Label className="text-sm font-medium">Date</Label>
              <Input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Right Side - Payer & Split */}
          <div className="p-6 space-y-6 bg-muted/30">
            {/* Who Paid */}
            <div>
              <Label className="text-xs uppercase text-muted-foreground tracking-wider">
                Who Paid?
              </Label>
              <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                {members.slice(0, 6).map((member) => {
                  const memberId = member.id || member.user_id;
                  const isSelected = (memberId) === selectedPayer;
                  return (
                    <button
                      key={memberId}
                      onClick={() => setSelectedPayer(memberId)}
                      className={cn(
                        'w-full p-3 border rounded-xl flex items-center gap-3 transition-all text-left',
                        isSelected
                          ? 'border-primary bg-card'
                          : 'border-border bg-card hover:border-muted-foreground/50'
                      )}
                      style={
                        isSelected
                          ? { borderColor: 'hsl(168, 58%, 44%)' }
                          : {}
                      }
                    >
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={member.avatar_url} />
                        <AvatarFallback
                          style={
                            isSelected
                              ? { backgroundColor: 'hsl(168, 45%, 92%)', color: 'hsl(168, 58%, 44%)' }
                              : {}
                          }
                        >
                          {member.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{member.isYou ? 'You' : member.name}</p>
                        <p className="text-xs text-muted-foreground">paid full amount</p>
                      </div>
                      {isSelected && (
                        <Check className="w-5 h-5" style={{ color: 'hsl(168, 58%, 44%)' }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Split Details */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">
                  Split Details
                </Label>
                <div className="flex bg-muted rounded-lg p-1">
                  {['equal', 'exact', '%'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setSplitType(type === '%' ? 'percentage' : type)}
                      className={cn(
                        'px-3 py-1 text-sm rounded-md transition-colors',
                        (type === '%' ? 'percentage' : type) === splitType
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground'
                      )}
                    >
                      {type === '%' ? '%' : type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Members List */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {members.map((member) => {
                  const memberId = member.id || member.user_id;
                  const isSelected = selectedMembers.includes(memberId);
                  const memberAmount = getMemberAmount(memberId);
                  
                  return (
                    <div
                      key={memberId}
                      className={cn(
                        'flex items-center gap-3 p-3 border rounded-xl transition-all',
                        isSelected
                          ? 'border-primary bg-card'
                          : 'border-border bg-card opacity-50'
                      )}
                      style={
                        isSelected
                          ? { borderColor: 'hsl(168, 58%, 44%)' }
                          : {}
                      }
                    >
                      <div
                        onClick={() => toggleMember(memberId)}
                        className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer',
                          isSelected ? 'bg-primary' : 'bg-muted'
                        )}
                        style={
                          isSelected
                            ? { backgroundColor: 'hsl(168, 58%, 44%)' }
                            : {}
                        }
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={member.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {member.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 font-medium text-sm">
                        {member.isYou ? 'You' : member.name}
                      </span>
                      
                      {isSelected && (
                        <div className="flex items-center gap-2">
                          {splitType === 'equal' && (
                            <span
                              className="font-semibold text-sm"
                              style={{ color: 'hsl(168, 58%, 44%)' }}
                            >
                              ₹{memberAmount.toFixed(2)}
                            </span>
                          )}
                          
                          {splitType === 'exact' && (
                            <Input
                              type="number"
                              value={memberAmounts[memberId] || ''}
                              onChange={(e) => setMemberAmounts(prev => ({
                                ...prev,
                                [memberId]: e.target.value
                              }))}
                              placeholder="0.00"
                              className="w-20 h-8 text-right text-sm"
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                          
                          {splitType === 'percentage' && (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                value={memberPercentages[memberId] || ''}
                                onChange={(e) => setMemberPercentages(prev => ({
                                  ...prev,
                                  [memberId]: e.target.value
                                }))}
                                placeholder="0"
                                className="w-16 h-8 text-right text-sm"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="text-xs text-muted-foreground">%</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {validationError && (
                <p className="text-xs text-red-500 mt-2">
                  {validationError}
                </p>
              )}
              
              {splitType === 'equal' && (
                <p className="text-xs text-muted-foreground mt-2">
                  <Check className="w-3 h-3 inline mr-1" style={{ color: 'hsl(168, 58%, 44%)' }} />
                  Amounts calculated automatically
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between p-4 border-t"
          style={{ backgroundColor: 'hsl(180, 20%, 98%)' }}
        >
          <div className="text-sm text-muted-foreground">
            {splitType === 'equal' && (
              <span>
                Split equally among{' '}
                <span className="font-medium text-foreground">{selectedMembers.length} people</span>
              </span>
            )}
            {splitType === 'exact' && (
              <span>
                Custom amounts for{' '}
                <span className="font-medium text-foreground">{selectedMembers.length} people</span>
              </span>
            )}
            {splitType === 'percentage' && (
              <span>
                Custom percentages for{' '}
                <span className="font-medium text-foreground">{selectedMembers.length} people</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!amount || !description || isSaving}
              style={{ backgroundColor: 'hsl(168, 58%, 44%)' }}
            >
              <Check className="w-4 h-4 mr-2" />
              {isSaving ? 'Adding...' : 'Save Expense'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
