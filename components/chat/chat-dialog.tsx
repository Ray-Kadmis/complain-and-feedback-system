"use client"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { ChatInterface } from "@/components/chat/chat-interface"

interface ChatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roomId: string // Changed from chatRoomId to roomId to match ChatInterface
  complaintTitle: string
}

export function ChatDialog({ open, onOpenChange, roomId, complaintTitle }: ChatDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] p-0">
        <ChatInterface roomId={roomId} complaintTitle={complaintTitle} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
