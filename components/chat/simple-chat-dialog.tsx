"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { SimpleChat } from "./simple-chat"

interface SimpleChatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  complaintId: string
  complaintTitle: string
}

export function SimpleChatDialog({ open, onOpenChange, complaintId, complaintTitle }: SimpleChatDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden">
        <SimpleChat complaintId={complaintId} complaintTitle={complaintTitle} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
