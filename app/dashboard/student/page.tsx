"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { CheckCircle, XCircle } from "lucide-react"
import { initializeApp } from "firebase/app"
import { getAuth, onAuthStateChanged } from "firebase/auth"
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc } from "firebase/firestore"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Firebase configuration
const firebaseConfig = {
  // Your Firebase config here
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

type Complaint = {
  id: string
  title: string
  category: string
  subcategory: string
  description: string
  status: string
  createdAt: any
  updatedAt: any
  username: string
  semester: string
}

export default function StudentDashboard() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [isStudent, setIsStudent] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null)
  const [resolutionDialogOpen, setResolutionDialogOpen] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Check if user is a student
        const userDoc = await getDoc(doc(db, "users", user.uid))
        if (userDoc.exists() && userDoc.data()?.role === "student") {
          setIsStudent(true)
          setUsername(userDoc.data()?.username || "")
          fetchComplaints(user.uid, userDoc)
        } else {
          toast.error("Access denied", {
            description: "You don't have permission to access the student dashboard.",
          })
          router.push("/")
        }
      } else {
        router.push("/login/student")
      }
      setIsLoading(false)
    })

    return () => unsubscribe()
  }, [router])

  const fetchComplaints = async (userId: string, userDoc: any) => {
    try {
      const q = query(collection(db, "complaints"), where("userId", "==", userId))
      const querySnapshot = await getDocs(q)
      const complaintsData: Complaint[] = []

      querySnapshot.forEach((doc) => {
        const data = doc.data()
        complaintsData.push({
          id: doc.id,
          title: data.title,
          category: data.category,
          subcategory: data.subcategory || "",
          description: data.description,
          status: data.status,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          username: data.username,
          semester: data.semester || "",
        })
      })

      // Sort by date (newest first)
      complaintsData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      setComplaints(complaintsData)

      // Check if any complaints need resolution confirmation
      const awaitingConfirmationComplaints = complaintsData.filter(
        (complaint) => complaint.status === "awaiting confirmation",
      )
      if (awaitingConfirmationComplaints.length > 0) {
        setSelectedComplaint(awaitingConfirmationComplaints[0])
        setResolutionDialogOpen(true)
      }
    } catch (error) {
      console.error("Error fetching complaints:", error)
      toast.error("Error", {
        description: "Failed to load complaints. Please try again.",
      })
    }
  }

  const handleResolutionConfirmation = async (confirmed: boolean) => {
    if (!selectedComplaint) return

    try {
      await updateDoc(doc(db, "complaints", selectedComplaint.id), {
        studentConfirmed: true,
        status: confirmed ? "resolved" : "active",
        studentResolutionResponse: confirmed ? "confirmed" : "rejected",
        updatedAt: new Date(),
      })

      // Update local state
      setComplaints(
        complaints.map((c) =>
          c.id === selectedComplaint.id
            ? {
                ...c,
                status: confirmed ? "resolved" : "active",
                studentConfirmed: true,
                updatedAt: new Date(),
              }
            : c,
        ),
      )

      toast.success(confirmed ? "Resolution confirmed" : "Issue reported as unresolved", {
        description: confirmed
          ? "Thank you for confirming that your issue has been resolved."
          : "The complaint has been sent back to the faculty for further action.",
      })

      // Close dialog and check for next complaint needing confirmation
      setResolutionDialogOpen(false)
      setSelectedComplaint(null)

      const nextUnconfirmed = complaints.find(
        (c) => c.status === "awaiting confirmation" && c.id !== selectedComplaint.id,
      )
      if (nextUnconfirmed) {
        setTimeout(() => {
          setSelectedComplaint(nextUnconfirmed)
          setResolutionDialogOpen(true)
        }, 500)
      }
    } catch (error) {
      console.error("Error updating complaint:", error)
      toast.error("Error", {
        description: "Failed to update complaint status. Please try again.",
      })
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "pending":
        return "secondary"
      case "under review":
        return "warning"
      case "active":
        return "default"
      case "in-progress":
        return "default"
      case "awaiting confirmation":
        return "info"
      case "resolved":
        return "success"
      case "rejected":
        return "destructive"
      default:
        return "outline"
    }
  }

  const handleLogout = async () => {
    try {
      await auth.signOut()
      router.push("/")
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  if (!isStudent) {
    return null // Will redirect in useEffect
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-4xl font-bold">Student Dashboard</h1>
        <div className="flex items-center gap-4">
          <span>Welcome, {username}</span>
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Make a Complaint</CardTitle>
            <CardDescription>Submit a new complaint or feedback</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => router.push("/dashboard/student/make-complaint")}>
              Make a Complaint
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Previous Complaints</CardTitle>
            <CardDescription>View your resolved complaint history</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => router.push("/dashboard/student/previous-complaints")}>
              View History
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Complaints</CardTitle>
          <CardDescription>All complaints submitted by you</CardDescription>
        </CardHeader>
        <CardContent>
          {complaints.length > 0 ? (
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-3 text-left">Category \ Subcategory</th>
                    <th className="p-3 text-left">Title</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Submitted By</th>
                    <th className="p-3 text-left">Semester</th>
                    <th className="p-3 text-left">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.map((complaint) => (
                    <tr key={complaint.id} className="border-b hover:bg-muted/50">
                      <td className="p-3">
                        {complaint.category.charAt(0).toUpperCase() + complaint.category.slice(1)} \{" "}
                        {complaint.subcategory.charAt(0).toUpperCase() + complaint.subcategory.slice(1)}
                      </td>
                      <td className="p-3">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">{complaint.title}</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <p className="text-sm">{complaint.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                      <td className="p-3">
                        <Badge variant={getStatusBadgeVariant(complaint.status) as any}>
                          {complaint.status === "awaiting confirmation"
                            ? "Awaiting Confirmation"
                            : complaint.status.charAt(0).toUpperCase() + complaint.status.slice(1)}
                        </Badge>
                      </td>
                      <td className="p-3">{complaint.username}</td>
                      <td className="p-3">{complaint.semester || "N/A"}</td>
                      <td className="p-3">{complaint.createdAt.toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground">You haven't submitted any complaints yet</p>
              <Button className="mt-4" onClick={() => router.push("/dashboard/student/make-complaint")}>
                Make a Complaint
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolution Confirmation Dialog - Cannot be closed with the close button */}
      <Dialog
        open={resolutionDialogOpen}
        onOpenChange={(open) => {
          // Only allow closing if there's no selected complaint
          if (!selectedComplaint) {
            setResolutionDialogOpen(open)
          }
        }}
      >
        <DialogContent className="sm:max-w-md" hideCloseButton={!!selectedComplaint}>
          <DialogHeader>
            <DialogTitle>Confirm Resolution</DialogTitle>
            <DialogDescription>
              This complaint has been marked as resolved by faculty. Please confirm if the issue has actually been
              resolved.
            </DialogDescription>
          </DialogHeader>
          {selectedComplaint && (
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Category \ Subcategory:</p>
                <p className="text-sm">
                  {selectedComplaint.category.charAt(0).toUpperCase() + selectedComplaint.category.slice(1)} \{" "}
                  {selectedComplaint.subcategory.charAt(0).toUpperCase() + selectedComplaint.subcategory.slice(1)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Title:</p>
                <p className="text-sm">{selectedComplaint.title}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Message:</p>
                <p className="text-sm">{selectedComplaint.description}</p>
              </div>
              {selectedComplaint.semester && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Semester:</p>
                  <p className="text-sm">{selectedComplaint.semester}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex flex-row justify-between sm:justify-between">
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => handleResolutionConfirmation(false)}
            >
              <XCircle className="h-4 w-4" /> No, still an issue
            </Button>
            <Button className="flex items-center gap-2" onClick={() => handleResolutionConfirmation(true)}>
              <CheckCircle className="h-4 w-4" /> Yes, resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
