"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, ArrowLeft, ExternalLink } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  getDoc,
  doc,
  onSnapshot,
  orderBy,
  FirestoreError,
  limit,
} from "firebase/firestore"

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

interface Message {
  id: string
  complaintId: string
  text: string
  senderId: string
  senderName: string
  senderRole: string
  timestamp: Date
}

interface SimpleChatProps {
  complaintId: string
  complaintTitle: string
  onClose?: () => void
}

export function SimpleChat({ complaintId, complaintTitle, onClose }: SimpleChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [indexError, setIndexError] = useState<string | null>(null)
  const [useRealtime, setUseRealtime] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const currentUser = auth.currentUser
  const indexCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Function to fetch messages without using orderBy (no index required)
  const fetchMessagesWithoutIndex = async () => {
    try {
      setLoading(true)
      // Simple query without orderBy
      const q = query(collection(db, "chats"), where("complaintId", "==", complaintId))
      const querySnapshot = await getDocs(q)

      const fetchedMessages: Message[] = []
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        fetchedMessages.push({
          id: doc.id,
          complaintId: data.complaintId,
          text: data.text,
          senderId: data.senderId,
          senderName: data.senderName,
          senderRole: data.senderRole,
          timestamp: data.timestamp?.toDate() || new Date(),
        })
      })

      // Sort messages by timestamp manually
      fetchedMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

      setMessages(fetchedMessages)
    } catch (error) {
      console.error("Error fetching messages without index:", error)
      toast.error("Failed to load messages")
    } finally {
      setLoading(false)
    }
  }

  // Function to check if the index exists by attempting a query that requires it
  const checkIfIndexExists = async () => {
    try {
      // Try a query that requires the index, but limit to 1 document to minimize overhead
      const q = query(
        collection(db, "chats"),
        where("complaintId", "==", complaintId),
        orderBy("timestamp", "asc"),
        limit(1),
      )

      await getDocs(q)
      // If we get here, the index exists
      setIndexError(null)
      setUseRealtime(true)

      // Clear the interval if it exists
      if (indexCheckIntervalRef.current) {
        clearInterval(indexCheckIntervalRef.current)
        indexCheckIntervalRef.current = null
      }

      return true
    } catch (error) {
      if (error instanceof FirestoreError && error.code === "failed-precondition") {
        // Extract the index creation URL from the error message
        const match = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]+/)
        if (match) {
          setIndexError(match[0])
        } else {
          setIndexError("https://console.firebase.google.com")
        }
        setUseRealtime(false)
        return false
      }

      // Some other error occurred
      console.error("Error checking index:", error)
      return false
    }
  }

  // Set up message fetching and listening
  useEffect(() => {
    if (!complaintId || !currentUser) {
      if (!complaintId) {
        console.error("Complaint ID is missing")
      }
      return
    }

    let unsubscribe: () => void = () => {}

    const setupMessaging = async () => {
      // First check if the index exists
      const indexExists = await checkIfIndexExists()

      if (indexExists) {
        // If index exists, use real-time listener with orderBy
        const q = query(collection(db, "chats"), where("complaintId", "==", complaintId), orderBy("timestamp", "asc"))

        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const newMessages: Message[] = []
            snapshot.forEach((doc) => {
              const data = doc.data()
              newMessages.push({
                id: doc.id,
                complaintId: data.complaintId,
                text: data.text,
                senderId: data.senderId,
                senderName: data.senderName,
                senderRole: data.senderRole,
                timestamp: data.timestamp?.toDate() || new Date(),
              })
            })

            setMessages(newMessages)
            setLoading(false)
          },
          (error) => {
            console.error("Error in real-time listener:", error)
            // If we get an error with the real-time listener, fall back to non-indexed approach
            fetchMessagesWithoutIndex()
          },
        )
      } else {
        // If index doesn't exist, fetch messages without using orderBy
        await fetchMessagesWithoutIndex()

        // Set up an interval to periodically check if the index has been created
        indexCheckIntervalRef.current = setInterval(async () => {
          const indexNowExists = await checkIfIndexExists()
          if (indexNowExists) {
            // If index now exists, clear interval and re-setup messaging
            if (indexCheckIntervalRef.current) {
              clearInterval(indexCheckIntervalRef.current)
              indexCheckIntervalRef.current = null
            }
            setupMessaging()
          }
        }, 10000) // Check every 10 seconds
      }
    }

    setupMessaging()

    // Cleanup function
    return () => {
      unsubscribe()
      if (indexCheckIntervalRef.current) {
        clearInterval(indexCheckIntervalRef.current)
        indexCheckIntervalRef.current = null
      }
    }
  }, [complaintId, currentUser])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    // Focus the input when the component mounts
    inputRef.current?.focus()
  }, [])

  // Function to handle sending a new message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUser || !complaintId) {
      if (!complaintId) {
        toast.error("Complaint ID is missing")
      }
      return
    }

    try {
      setSending(true)

      // Get current user data
      const userDoc = await getDoc(doc(db, "users", currentUser.uid))
      const userData = userDoc.data() || {}

      // Add message to Firestore
      await addDoc(collection(db, "chats"), {
        complaintId,
        text: newMessage.trim(),
        senderId: currentUser.uid,
        senderName: userData.username || "Unknown User",
        senderRole: userData.role || "unknown",
        timestamp: serverTimestamp(),
      })

      // If we're not using real-time updates, manually fetch messages again
      if (!useRealtime) {
        await fetchMessagesWithoutIndex()
      }

      // Clear input
      setNewMessage("")

      // Focus the input after sending
      setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
    } catch (error) {
      console.error("Error sending message:", error)
      toast.error("Failed to send message")
    } finally {
      setSending(false)
    }
  }

  // Function to get message background color based on sender role
  const getMessageBackgroundColor = (role: string, isCurrentUser: boolean) => {
    if (isCurrentUser) {
      return "bg-blue-500 text-white" // Current user's messages are blue
    }

    switch (role.toLowerCase()) {
      case "student":
        return "bg-green-100 text-green-900 border border-green-200"
      case "faculty":
        return "bg-yellow-100 text-yellow-900 border border-yellow-200"
      case "admin":
        return "bg-green-100 text-green-900 border border-green-200" // Same as student
      default:
        return "bg-gray-100 text-gray-900 border border-gray-200"
    }
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
  const groupedMessages: { date: string; messages: Message[] }[] = []
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

  // Function to handle creating the index
  const handleCreateIndex = () => {
    if (indexError) {
      window.open(indexError, "_blank")
    }
  }

  // Function to manually refresh messages
  const handleRefreshMessages = async () => {
    await fetchMessagesWithoutIndex()
  }

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
          </div>
        </div>
        {!useRealtime && !loading && (
          <Button variant="ghost" size="sm" onClick={handleRefreshMessages}>
            Refresh
          </Button>
        )}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 text-gray-100">
        {indexError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Database Index Required for Real-time Updates</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <p>A database index needs to be created for real-time chat updates to work properly.</p>
              <p>
                You can still send and receive messages, but you'll need to refresh manually to see new messages until
                the index is created.
              </p>
              <Button variant="outline" className="w-fit flex items-center gap-2" onClick={handleCreateIndex}>
                Create Index <ExternalLink size={16} />
              </Button>
              <p className="text-sm">After creating the index, please wait a few minutes for it to be active.</p>
            </AlertDescription>
          </Alert>
        )}

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
                const messageBackgroundClass = getMessageBackgroundColor(message.senderRole, isCurrentUser)

                return (
                  <div key={message.id} className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg p-3 ${messageBackgroundClass}`}>
                      {!isCurrentUser && (
                        <p className="text-xs font-medium mb-1">
                          {message.senderName} ({message.senderRole})
                        </p>
                      )}

                      <p className="whitespace-pre-wrap break-words">{message.text}</p>
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

      {/* Chat Input */}
      <div className="p-4 border-t border-gray-800 bg-black/40 backdrop-blur-md z-10">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
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
          />
          <Button onClick={handleSendMessage} disabled={!newMessage.trim() || sending}>
            <Send className="h-5 w-5" />
          </Button>
        </div>
        {!useRealtime && !indexError && (
          <p className="text-xs text-muted-foreground mt-2">
            Note: You may need to refresh to see new messages from others.
          </p>
        )}
      </div>
    </div>
  )
}
