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
import { AlertCircle, CheckCircle, Users } from 'lucide-react';
import { toast } from 'sonner';
import { joinGroup } from '@/services/api';

export default function JoinGroupModal({ open, onOpenChange, onSuccess }) {
  const [inviteCode, setInviteCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setInviteCode('');
      setError('');
      setSuccess('');
      setIsJoining(false);
    }
  }, [open]);

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;

    setIsJoining(true);
    setError('');
    setSuccess('');

    try {
      // Call API to join group
      const group = await joinGroup(inviteCode.trim().toUpperCase());

      // Show success message with group name
      const successMessage = `Successfully joined ${group.name}!`;
      setSuccess(successMessage);
      toast.success('Joined group successfully!', {
        description: `You're now a member of ${group.name}`,
      });

      // Close modal and refresh groups list after short delay
      setTimeout(() => {
        setInviteCode('');
        setError('');
        setSuccess('');
        onOpenChange(false);

        // Call onSuccess callback to refresh groups list
        if (onSuccess) {
          onSuccess();
        }
      }, 1500);
    } catch (err) {
      // Error is already handled by API service layer
      setError(err.message || 'Invalid invite code. Please check and try again.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Join a group</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Enter the invite code shared by the group admin.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Icon */}
          <div className="flex justify-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'hsl(168, 45%, 92%)' }}
            >
              <Users className="w-8 h-8" style={{ color: 'hsl(168, 58%, 44%)' }} />
            </div>
          </div>

          {/* Input */}
          <div>
            <Label className="text-sm font-medium">Invite Code</Label>
            <Input
              placeholder="e.g. X8J2-9K"
              value={inviteCode}
              onChange={(e) => {
                setInviteCode(e.target.value.toUpperCase());
                setError('');
                setSuccess('');
              }}
              className="mt-1.5 text-center text-lg font-mono tracking-widest"
            />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Enter the invite code shared by the group admin
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-600 rounded-lg text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              {success}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleJoin}
            disabled={!inviteCode.trim() || isJoining}
            style={{ backgroundColor: 'hsl(168, 58%, 44%)' }}
          >
            {isJoining ? 'Joining...' : 'Join Group'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
