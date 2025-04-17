"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { initializeApp } from "firebase/app"
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth"
import { getFirestore, doc, setDoc } from "firebase/firestore"

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

export default function TestAuth() {
  const [email, setEmail] = useState("systemadmin@usp.edu")
  const [password, setPassword] = useState("admin123")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState("")

  const handleLogin = async () => {
    setLoading(true)
    setResult("")

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      setResult(`Login successful! User ID: ${userCredential.user.uid}`)
      toast.success("Login successful!")
    } catch (error: any) {
      setResult(`Error: ${error.message}`)
      toast.error(`Login failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAdmin = async () => {
    setLoading(true)
    setResult("")

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)

      // Add user to Firestore with admin role
      await setDoc(doc(db, "users", userCredential.user.uid), {
        username: email.split("@")[0],
        role: "admin",
        createdAt: new Date().toISOString(),
      })

      setResult(`Admin created successfully! User ID: ${userCredential.user.uid}`)
      toast.success("Admin created successfully!")
    } catch (error: any) {
      setResult(`Error: ${error.message}`)
      toast.error(`Failed to create admin: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Firebase Authentication Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          <div className="flex space-x-2">
            <Button onClick={handleLogin} disabled={loading} className="flex-1">
              Test Login
            </Button>
            <Button onClick={handleCreateAdmin} disabled={loading} className="flex-1">
              Create Admin
            </Button>
          </div>

          {result && (
            <div className="mt-4 p-3 bg-gray-100 rounded-md text-sm font-mono whitespace-pre-wrap">{result}</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
