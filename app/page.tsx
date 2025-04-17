"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
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

export default function Home() {
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check if user is already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in, check their role
        const userDoc = await getDoc(doc(db, "users", user.uid))
        if (userDoc.exists()) {
          const userData = userDoc.data()
          // Redirect to appropriate dashboard
          router.push(`/dashboard/${userData.role}`)
        }
      }
      setIsLoading(false)
    })

    return () => unsubscribe()
  }, [router])

  const handleRoleSelect = (role: string) => {
    setSelectedRole(role)
    router.push(`/login/${role}`)
  }

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">University Feedback System</CardTitle>
          <CardDescription>Please select your role to continue</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Button variant="outline" className="h-16 text-lg" onClick={() => handleRoleSelect("student")}>
            Student
          </Button>
          <Button variant="outline" className="h-16 text-lg" onClick={() => handleRoleSelect("faculty")}>
            Faculty
          </Button>
          <Button variant="outline" className="h-16 text-lg" onClick={() => handleRoleSelect("admin")}>
            Administrator
          </Button>
        </CardContent>
        <CardFooter className="text-center text-sm text-muted-foreground">
          Select your role to access the appropriate login page
        </CardFooter>
      </Card>
    </div>
  )
}
