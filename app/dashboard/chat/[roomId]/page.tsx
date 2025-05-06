"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ChatInterface } from "@/components/chat/chat-interface"
import { initializeApp } from "firebase/app"
import { getAuth, onAuthStateChanged } from "firebase/auth"
import { getFirestore, doc, getDoc } from "firebase/firestore"

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

export default function ChatRoomPage({ params }: { params: { roomId: string } }) {
  const { roomId } = params
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [complaintTitle, setComplaintTitle] = useState("")
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/")
        return
      }

      try {
        // Check if chat room exists and user has access
        const roomDoc = await getDoc(doc(db, "chatRooms", roomId))

        if (!roomDoc.exists()) {
          toast.error("Chat room not found")
          router.push("/dashboard/student")
          return
        }

        const roomData = roomDoc.data()

        // Check if user is a participant
        if (!roomData.participants.includes(user.uid)) {
          toast.error("You don't have access to this chat room")
          router.push("/dashboard/student")
          return
        }

        setComplaintTitle(roomData.complaintTitle || "Untitled Complaint")
        setHasAccess(true)
      } catch (error) {
        console.error("Error fetching chat room:", error)
        toast.error("Failed to load chat room")
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [roomId, router])

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  if (!hasAccess) {
    return null // Will redirect in useEffect
  }

  return (
    <div className="container mx-auto py-10">
      <Button variant="outline" onClick={() => router.back()} className="mb-6">
        Back
      </Button>

      <div className="max-w-4xl mx-auto">
        <ChatInterface roomId={roomId} complaintTitle={complaintTitle} />
      </div>
    </div>
  )
}
