"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Paperclip, Send, ArrowLeft, Download, X } from "lucide-react"
import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import type { ChatMessage } from "@/types/chat"

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)
const storage = getStorage(app)

interface ChatInterfaceProps {
  roomId: string
  complaintTitle: string
  onClose?: () => void
}

export function ChatInterface({ roomId, complaintTitle, onClose }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [participants, setParticipants] = useState<Record<string, { name: string; role: string }>>({})
  const [files, setFiles] = useState<File[]>([])
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const currentUser = auth.currentUser

  // Fetch chat room data and messages
  useEffect(() => {
    if (!roomId || !currentUser) {
      if (!roomId) {
        console.error("Chat room ID is missing")
      }
      return
    }

    // Mark messages as read when the chat is opened
    const markMessagesAsRead = async () => {
      const roomRef = doc(db, "chatRooms", roomId)
      const roomDoc = await getDoc(roomRef)

      if (roomDoc.exists()) {
        const roomData = roomDoc.data()
        const unreadCount = roomData.unreadCount || {}

        // Reset unread count for current user
        if (unreadCount[currentUser.uid]) {
          await updateDoc(roomRef, {
            [`unreadCount.${currentUser.uid}`]: 0,
          })
        }
      }
    }

    markMessagesAsRead()

    // Fetch participants
    const fetchParticipants = async () => {
      const roomRef = doc(db, "chatRooms", roomId)
      const roomDoc = await getDoc(roomRef)

      if (roomDoc.exists()) {
        const roomData = roomDoc.data()
        const participantIds = roomData.participants || []

        const participantsData: Record<string, { name: string; role: string }> = {}

        for (const userId of participantIds) {
          const userDoc = await getDoc(doc(db, "users", userId))
          if (userDoc.exists()) {
            const userData = userDoc.data()
            participantsData[userId] = {
              name: userData.username || "Unknown User",
              role: userData.role || "unknown",
            }
          }
        }

        setParticipants(participantsData)
      }
    }

    fetchParticipants()

    // Listen for new messages
    const q = query(collection(db, "chatMessages"), where("roomId", "==", roomId), orderBy("timestamp", "asc"))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages: ChatMessage[] = []

      snapshot.forEach((doc) => {
        const data = doc.data()
        newMessages.push({
          id: doc.id,
          roomId: data.roomId,
          content: data.content,
          senderId: data.senderId,
          senderName: data.senderName,
          senderRole: data.senderRole,
          timestamp: data.timestamp?.toDate() || new Date(),
          attachments: data.attachments || [],
          isRead: data.isRead || {},
        })
      })

      setMessages(newMessages)
      setLoading(false)

      // Mark messages as read
      newMessages.forEach(async (message) => {
        if (message.senderId !== currentUser.uid && (!message.isRead || !message.isRead[currentUser.uid])) {
          await updateDoc(doc(db, "chatMessages", message.id), {
            [`isRead.${currentUser.uid}`]: true,
          })
        }
      })
    })

    return () => unsubscribe()
  }, [roomId, currentUser])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && files.length === 0) || !currentUser || sending || !roomId) {
      // Add check for roomId
      if (!roomId) {
        toast.error("Chat room ID is missing")
      }
      return
    }

    try {
      setSending(true)

      // Get current user data
      const userDoc = await getDoc(doc(db, "users", currentUser.uid))
      const userData = userDoc.data() || {}

      // Upload files if any
      const attachments = []

      if (files.length > 0) {
        for (const file of files) {
          const storageRef = ref(storage, `chat-attachments/${roomId}/${Date.now()}-${file.name}`)
          const uploadTask = uploadBytesResumable(storageRef, file)

          // Monitor upload progress
          await new Promise<void>((resolve, reject) => {
            uploadTask.on(
              "state_changed",
              (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                setUploadProgress((prev) => ({ ...prev, [file.name]: progress }))
              },
              (error) => {
                console.error("Upload error:", error)
                reject(error)
              },
              async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
                attachments.push({
                  name: file.name,
                  url: downloadURL,
                  type: file.type,
                  size: file.size,
                })
                resolve()
              },
            )
          })
        }
      }

      // Add message to Firestore
      await addDoc(collection(db, "chatMessages"), {
        roomId,
        content: newMessage.trim(),
        senderId: currentUser.uid,
        senderName: userData.username || "Unknown User",
        senderRole: userData.role || "unknown",
        timestamp: serverTimestamp(),
        attachments,
        isRead: { [currentUser.uid]: true },
      })

      // Update last message in chat room
      await updateDoc(doc(db, "chatRooms", roomId), {
        lastMessage: {
          content: newMessage.trim() || (attachments.length > 0 ? `Shared ${attachments.length} file(s)` : ""),
          timestamp: new Date(),
          senderId: currentUser.uid,
        },
        // Increment unread count for all participants except sender
        ...Object.fromEntries(
          Object.keys(participants)
            .filter((id) => id !== currentUser.uid)
            .map((id) => [`unreadCount.${id}`, 1]),
        ),
      })

      // Clear input and files
      setNewMessage("")
      setFiles([])
      setUploadProgress({})
    } catch (error) {
      console.error("Error sending message:", error)
      toast.error("Failed to send message")
    } finally {
      setSending(false)
    }
  }

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setFiles((prev) => [...prev, ...newFiles])
    }
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const formatDate = (date: Date) => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return "Today"
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday"
    } else {
      return date.toLocaleDateString()
    }
  }

  // Group messages by date
  const groupedMessages: { date: string; messages: ChatMessage[] }[] = []
  let currentDate = ""

  messages.forEach((message) => {
    const messageDate = formatDate(message.timestamp)

    if (messageDate !== currentDate) {
      currentDate = messageDate
      groupedMessages.push({
        date: messageDate,
        messages: [message],
      })
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(message)
    }
  })

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] max-h-[800px] bg-black/30 backdrop-blur-xl rounded-lg shadow-lg border border-gray-800 relative overflow-hidden">
      <div className="absolute inset-0 bg-noise opacity-10 mix-blend-overlay pointer-events-none"></div>
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-black/40 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="mr-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h3 className="font-semibold">Chat: {complaintTitle}</h3>
            <p className="text-xs text-muted-foreground">
              {Object.values(participants)
                .map((p) => p.name)
                .join(", ")}
            </p>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 text-gray-100">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <p>Loading messages...</p>
          </div>
        ) : groupedMessages.length > 0 ? (
          groupedMessages.map((group, groupIndex) => (
            <div key={groupIndex} className="space-y-4">
              <div className="flex justify-center">
                <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">{group.date}</span>
              </div>

              {group.messages.map((message) => {
                const isCurrentUser = message.senderId === currentUser?.uid

                return (
                  <div key={message.id} className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        isCurrentUser ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      {!isCurrentUser && (
                        <p className="text-xs font-medium mb-1">
                          {message.senderName} ({message.senderRole})
                        </p>
                      )}

                      {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}

                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {message.attachments.map((attachment, index) => (
                            <div
                              key={index}
                              className={`flex items-center gap-2 p-2 rounded ${
                                isCurrentUser ? "bg-primary-foreground/20" : "bg-background"
                              }`}
                            >
                              <Paperclip className="h-4 w-4 shrink-0" />
                              <span className="text-sm truncate flex-1">{attachment.name}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => window.open(attachment.url, "_blank")}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      <p className="text-xs mt-1 opacity-70 text-right">{formatTime(message.timestamp)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        ) : (
          <div className="flex justify-center items-center h-full">
            <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* File Attachments Preview */}
      {files.length > 0 && (
        <div className="px-4 py-2 border-t flex gap-2 overflow-x-auto">
          {files.map((file, index) => (
            <div key={index} className="flex items-center gap-1 bg-muted rounded-full pl-2 pr-1 py-1">
              <span className="text-xs truncate max-w-[100px]">{file.name}</span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeFile(index)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Chat Input */}
      <div className="p-4 border-t border-gray-800 bg-black/40 backdrop-blur-md z-10">
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleFileSelect} disabled={sending}>
            <Paperclip className="h-5 w-5" />
          </Button>
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            disabled={sending}
          />
          <Button onClick={handleSendMessage} disabled={(!newMessage.trim() && files.length === 0) || sending}>
            <Send className="h-5 w-5" />
          </Button>
        </div>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
      </div>
    </div>
  )
}
