import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Home, Plane, Heart, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { createGroup } from '@/services/api';

const groupTypes = [
  { id: 'trip', label: 'Trip', icon: Plane },
  { id: 'home', label: 'Home', icon: Home },
  { id: 'couple', label: 'Couple', icon: Heart },
  { id: 'other', label: 'Other', icon: Users },
];

export default function CreateGroupModal({ open, onOpenChange, onSuccess }) {
  const [groupName, setGroupName] = useState('');
  const [selectedType, setSelectedType] = useState('trip');
  const [simplifyDebts, setSimplifyDebts] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      // Reset form state when modal is closed
      setGroupName('');
      setSelectedType('trip');
      setSimplifyDebts(true);
      setIsCreating(false);
    }
  }, [open]);

  const handleCreate = async () => {
    if (!groupName.trim()) return;

    setIsCreating(true);

    try {
      // Call API to create group
      const newGroup = await createGroup({
        name: groupName.trim(),
        type: selectedType,
        currency: 'INR',
        simplify_debts: simplifyDebts,
      });

      // Show success toast with invite code
      toast.success('Group created successfully!', {
        description: `Invite code: ${newGroup.invite_code}`,
      });

      // Reset form
      setGroupName('');
      setSelectedType('trip');
      setSimplifyDebts(true);

      // Close modal
      onOpenChange(false);

      // Call onSuccess callback to refresh groups list
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      // Error is already handled by API service layer, but show user-friendly message
      toast.error('Failed to create group', {
        description: error.message || 'Please try again',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Create a group</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Set up a space to track expenses together.
          </p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Group Name */}
          <div className="flex items-start gap-4">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center border-2 border-dashed flex-shrink-0"
              style={{ borderColor: 'hsl(168, 58%, 44%)', backgroundColor: 'hsl(168, 45%, 92%)' }}
            >
              {groupTypes.find((t) => t.id === selectedType)?.icon && (
                <div style={{ color: 'hsl(168, 58%, 44%)' }}>
                  {(() => {
                    const Icon = groupTypes.find((t) => t.id === selectedType)?.icon;
                    return Icon ? <Icon className="w-6 h-6" /> : null;
                  })()}
                </div>
              )}
            </div>
            <div className="flex-1">
              <Label className="text-sm font-medium">Group name</Label>
              <Input
                placeholder="e.g. Summer Trip 2025"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Group Type */}
          <div>
            <Label className="text-sm font-medium">Group type</Label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {groupTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={cn(
                      'py-3 px-3 rounded-xl border text-sm font-medium transition-all flex flex-col items-center gap-2',
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
                    <Icon className="w-5 h-5" />
                    {type.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Default Currency */}
          <div>
            <Label className="text-sm font-medium">Default currency</Label>
            <div className="mt-2 flex items-center gap-3 p-3 border rounded-xl bg-muted/30">
              <span className="w-8 h-8 rounded-full bg-card flex items-center justify-center text-sm font-semibold border">
                ₹
              </span>
              <span className="text-sm">INR - Indian Rupee</span>
            </div>
          </div>

          {/* Simplify Group Debts */}
          <div
            className="flex items-center justify-between p-4 rounded-xl"
            style={{ backgroundColor: 'hsl(168, 45%, 92%)' }}
          >
            <div>
              <p className="text-sm font-medium">Simplify group debts</p>
              <p className="text-xs text-muted-foreground">
                Automatically offset balances to minimize transactions.
              </p>
            </div>
            <Switch checked={simplifyDebts} onCheckedChange={setSimplifyDebts} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!groupName.trim() || isCreating}
            style={{ backgroundColor: 'hsl(168, 58%, 44%)' }}
          >
            {isCreating ? 'Creating...' : 'Create Group'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
