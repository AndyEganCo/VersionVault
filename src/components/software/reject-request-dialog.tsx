import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface RejectRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  requestName: string;
  isLoading?: boolean;
}

export function RejectRequestDialog({
  open,
  onOpenChange,
  onConfirm,
  requestName,
  isLoading = false,
}: RejectRequestDialogProps) {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    onConfirm(reason);
    setReason(''); // Clear for next time
  };

  const handleCancel = () => {
    setReason('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Reject Request</DialogTitle>
          <DialogDescription>
            Provide feedback for why "{requestName}" is being rejected. This will be shown to the user.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-4">
          <Label htmlFor="reason">Rejection Reason</Label>
          <Textarea
            id="reason"
            placeholder="e.g., This software is not commonly used in professional AV environments..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground">
            Optional but recommended - helps users understand your decision
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Rejecting...' : 'Reject Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
