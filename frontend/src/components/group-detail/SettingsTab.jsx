import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Copy, Check, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { updateGroup, deleteGroup } from '@/services/api';

export default function SettingsTab({ group, groupId, onGroupUpdate, onGroupDelete }) {
  const [groupName, setGroupName] = useState(group?.name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const inviteCode = group?.invite_code || '';

  const handleCopyInviteCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      toast.success('Invite code copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveGroupName = async () => {
    if (!groupName.trim()) {
      toast.error('Group name cannot be empty');
      return;
    }

    if (groupName.trim() === group?.name) {
      toast.info('No changes to save');
      return;
    }

    setIsSaving(true);
    try {
      await updateGroup(groupId, { name: groupName.trim() });
      toast.success('Group name updated successfully!');
      if (onGroupUpdate) {
        onGroupUpdate();
      }
    } catch (error) {
      toast.error('Failed to update group name', {
        description: error.message || 'Please try again',
      });
      // Reset to original name on error
      setGroupName(group?.name || '');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    setIsDeleting(true);
    try {
      await deleteGroup(groupId);
      setDeleteModalOpen(false);
      if (onGroupDelete) {
        onGroupDelete();
      }
    } catch (error) {
      toast.error('Failed to delete group', {
        description: error.message || 'Please try again',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">Group Settings</h2>
        <p className="text-muted-foreground text-sm">Manage your group details and preferences</p>
      </div>

      {/* Group Details Card */}
      <Card>
        <CardContent className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-1">Group Details</h3>
            <p className="text-sm text-muted-foreground">Update your group information</p>
          </div>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Group Name</Label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="mt-1.5"
                placeholder="Enter group name"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Group Type</Label>
              <Input
                value={group?.type || ''}
                className="mt-1.5 bg-muted/50"
                disabled
                readOnly
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Invite Code</Label>
              <div className="flex items-center gap-2 mt-1.5">
                <Input
                  value={inviteCode}
                  className="font-mono bg-muted/50"
                  readOnly
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyInviteCode}
                  className="flex-shrink-0"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSaveGroupName}
              disabled={isSaving || groupName.trim() === group?.name}
              style={{ backgroundColor: 'hsl(168, 58%, 44%)' }}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Group Card */}
      <Card className="border-border">
        <CardContent className="p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">Delete Group</h3>
            <p className="text-sm text-muted-foreground">
              Permanently remove this group and all associated data
            </p>
          </div>
          <div className="pt-2">
            <p className="text-sm text-muted-foreground mb-4">
              This action cannot be undone. All expenses, budgets, and member information will be permanently deleted.
            </p>
            <Button
              variant="destructive"
              onClick={() => setDeleteModalOpen(true)}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Group
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{group?.name}"? This action cannot be undone. All expenses, budgets, and member data will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteGroup}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Group'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
