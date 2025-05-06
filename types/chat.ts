export type ChatRoom = {
  id: string
  complaintId: string
  complaintTitle: string
  participants: string[] // Array of user IDs
  createdAt: Date
  lastMessage?: {
    content: string
    timestamp: Date
    senderId: string
  }
  unreadCount?: Record<string, number> // Map of userId to unread count
}

export type ChatMessage = {
  id: string
  roomId: string
  content: string
  senderId: string
  senderName: string
  senderRole: string
  timestamp: Date
  attachments?: {
    name: string
    url: string
    type: string
    size: number
  }[]
  isRead?: Record<string, boolean> // Map of userId to read status
}
