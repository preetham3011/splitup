import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Check } from 'lucide-react';
import { toast } from 'sonner';
import { getSettlements, recordSettlement } from '@/services/api';

/**
 * Settlements Modal
 * 
 * Shows settlement suggestions from the backend using the greedy algorithm.
 * Allows users to record settlements as new expenses.
 */
export default function SettlementsModal({ open, onOpenChange, groupId, currentUserId, onSettlementRecorded }) {
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(null);

  // Fetch settlement suggestions
  const fetchSettlements = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSettlements(groupId);
      setSettlements(data.settlements || []);
    } catch (err) {
      toast.error('Failed to load settlement suggestions', {
        description: err.message || 'Please try again',
      });
      setSettlements([]);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  // Fetch settlement suggestions when modal opens
  useEffect(() => {
    if (open && groupId) {
      fetchSettlements();
    }
  }, [open, groupId, fetchSettlements]);

  const handleRecordSettlement = async (settlement) => {
    try {
      setRecording(settlement.from);

      // CRITICAL: Record settlement using the new API
      // Settlements are NOT expenses - they resolve debt
      // They do NOT affect total spent or budgets
      const response = await recordSettlement(groupId, {
        from: settlement.from,  // Debtor
        to: settlement.to,      // Creditor
        amount: settlement.amount,
      });

      toast.success('Settlement recorded', {
        description: `${settlement.from_name} paid ${settlement.to_name}: ₹${settlement.amount}`,
      });

      // Close modal and notify parent with updated balances from response
      // Backend returns updated balances, so we use them directly (no extra API call)
      onOpenChange(false);
      if (onSettlementRecorded) {
        onSettlementRecorded(response.balances);
      }
    } catch (err) {
      toast.error('Failed to record settlement', {
        description: err.message || 'Please try again',
      });
    } finally {
      setRecording(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Settlement Suggestions</DialogTitle>
          <DialogDescription>
            These are suggested transactions to settle all balances. Recording a settlement does NOT create an expense - it tracks money already paid.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {loading ? (
            // Loading state
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="w-20 h-8" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : settlements.length > 0 ? (
            <div className="space-y-3">
              {settlements.map((settlement, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* From user avatar */}
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-red-50 text-red-600">
                          {settlement.from_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>

                      {/* Transaction details */}
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          <span className="font-semibold">{settlement.from_name}</span>
                          <span className="text-muted-foreground mx-2">pays</span>
                          <span className="font-semibold">{settlement.to_name}</span>
                        </p>
                        <p className="text-lg font-bold" style={{ color: 'hsl(168, 58%, 44%)' }}>
                          ₹{settlement.amount.toLocaleString()}
                        </p>
                      </div>

                      {/* Record button */}
                      <Button
                        size="sm"
                        style={{ backgroundColor: 'hsl(168, 58%, 44%)' }}
                        onClick={() => handleRecordSettlement(settlement)}
                        disabled={recording !== null}
                      >
                        {recording === settlement.from ? (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Recording...
                          </>
                        ) : (
                          'Record'
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            // Empty state - all settled
            <Card>
              <CardContent className="text-center py-8">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: 'hsl(168, 45%, 92%)' }}
                >
                  <Check className="w-8 h-8" style={{ color: 'hsl(168, 58%, 44%)' }} />
                </div>
                <p className="text-lg font-medium text-foreground mb-1">All settled up!</p>
                <p className="text-muted-foreground">No settlements needed in this group.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {settlements.length > 0 && !loading && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">
              💡 <strong>Tip:</strong> Settlements track money already paid outside the app. They do NOT affect total spent or budgets.
              Suggested transactions minimize the number of payments needed.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
