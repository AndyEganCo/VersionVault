import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface EditSoftwareDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EditSoftwareDialog({ isOpen, onClose }: EditSoftwareDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-[425px]"
        aria-describedby="edit-software-description"
      >
        <DialogHeader>
          <DialogTitle>Edit Software</DialogTitle>
          <DialogDescription id="edit-software-description">
            Make changes to the software details below.
          </DialogDescription>
        </DialogHeader>
        {/* Your form content here */}
      </DialogContent>
    </Dialog>
  );
} 