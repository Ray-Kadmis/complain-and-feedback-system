"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ChevronDown, ExternalLink, Forward, MessageSquare } from "lucide-react"
import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore, collection, query, where, getDocs, FirestoreError } from "firebase/firestore"
import { SimpleChatDialog } from "@/components/chat/simple-chat-dialog"

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

type Complaint = {
  id: string
  title: string
  category: string
  subcategory: string
  description: string
  username: string
  userId: string
  semester?: string
  status: string
  createdAt: any
  updatedAt: any
  isExpanded?: boolean
  assignedTo?: string
  studentConfirmed?: boolean
  studentResolutionResponse?: string
  department?: string
}

type FacultyUser = {
  id: string
  username: string
  firstName: string
  lastName: string
  uniqueID: string
  department: string
}

export default function ViewComplaints() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [facultyUsers, setFacultyUsers] = useState<FacultyUser[]>([])
  const [loading, setLoading] = useState(true)
  const [indexError, setIndexError] = useState<string | null>(null)
  const [chatDialogOpen, setChatDialogOpen] = useState(false)
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null)
  const [selectedComplaintTitle, setSelectedComplaintTitle] = useState("")
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false)
  const [forwardingComplaint, setForwardingComplaint] = useState<Complaint | null>(null)
  const [selectedFaculty, setSelectedFaculty] = useState<string>("")

  useEffect(() => {
    fetchComplaints()
    fetchFacultyUsers()
  }, [])

  const fetchFacultyUsers = async () => {
    try {
      const q = query(collection(db, "users"), where("role", "==", "faculty"))
      const facultySnapshot = await getDocs(q)
      const facultyList = facultySnapshot.docs.map((doc) => ({
        id: doc.id,
        username: doc.data().username,
        firstName: doc.data().firstName || "",
        lastName: doc.data().lastName || "",
        uniqueID: doc.data().uniqueID || "",
        department: doc.data().department || "",
      }))
      setFacultyUsers(facultyList)
    } catch (error) {
      console.error("Error fetching faculty users:", error)
    }
  }

  const fetchComplaints = async () => {
    try {
      setLoading(true)
      // Fetch non-resolved complaints
      const q = query(collection(db, "complaints"), where("status", "not-in", ["resolved"]))
      const complaintsSnapshot = await getDocs(q)
      const complaintsList: Complaint[] = []

      complaintsSnapshot.forEach((doc) => {
        const data = doc.data()
        complaintsList.push({
          id: doc.id,
          title: data.title,
          category: data.category,
          subcategory: data.subcategory || "",
          description: data.description,
          username: data.username,
          userId: data.userId || "",
          semester: data.semester || "",
          status: data.status,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          isExpanded: false,
          assignedTo: data.assignedTo || null,
          studentConfirmed: data.studentConfirmed || false,
          studentResolutionResponse: data.studentResolutionResponse || "",
          department: data.department || "",
        })
      })

      // Sort in memory instead of using orderBy
      complaintsList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

      setComplaints(complaintsList)
      setIndexError(null)
      setLoading(false)
    } catch (error) {
      console.error("Error fetching complaints:", error)
      setLoading(false)

      // Check if it's an index error
      if (error instanceof FirestoreError && error.code === "failed-precondition") {
        const match = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]+/)
        if (match) {
          setIndexError(match[0])
        } else {
          setIndexError("https://console.firebase.google.com")
        }
      }
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

  const handleOpenChat = (complaint: Complaint) => {
    setSelectedComplaintId(complaint.id)
    setSelectedComplaintTitle(complaint.title)
    setChatDialogOpen(true)
  }

  const openForwardDialog = (complaint: Complaint) => {
    setForwardingComplaint(complaint)
    setSelectedFaculty("")
    setForwardDialogOpen(true)
  }

  // Format department name for display
  const formatDepartment = (departmentName: string | undefined) => {
    if (!departmentName) return "N/A"
    return departmentName
      .replace(/-/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  // Format title with department
  const formatTitleWithDepartment = (title: string, departmentName: string | undefined) => {
    const formattedDepartment = formatDepartment(departmentName)
    return `${title} / ${formattedDepartment}`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Complaints</CardTitle>
        <CardDescription>View and manage all complaints in the system</CardDescription>
      </CardHeader>
      <CardContent>
        {indexError && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Database Index Required</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <p>A database index needs to be created for this feature to work properly.</p>
              <p>Please click the button below to create the required index:</p>
              <Button
                variant="outline"
                className="w-fit flex items-center gap-2"
                onClick={() => window.open(indexError, "_blank")}
              >
                Create Index <ExternalLink size={16} />
              </Button>
              <p className="text-sm">After creating the index, please wait a few minutes and then refresh this page.</p>
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="text-center py-10">Loading complaints...</div>
        ) : complaints.length > 0 ? (
          <div className="space-y-4">
            {complaints.map((complaint) => (
              <Card key={complaint.id}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {formatTitleWithDepartment(complaint.title, complaint.department)}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {complaint.category.charAt(0).toUpperCase() + complaint.category.slice(1)} \{" "}
                        {complaint.subcategory.charAt(0).toUpperCase() + complaint.subcategory.slice(1)} • Submitted by:{" "}
                        {complaint.username} • Semester: {complaint.semester || "N/A"} • Date:{" "}
                        {complaint.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusBadgeVariant(complaint.status) as any}>
                        {complaint.status === "awaiting confirmation"
                          ? "Awaiting Confirmation"
                          : complaint.status.charAt(0).toUpperCase() + complaint.status.slice(1)}
                      </Badge>

                      {/* Chat button - admin can chat with any complaint */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex items-center gap-1"
                        onClick={() => handleOpenChat(complaint)}
                      >
                        <MessageSquare className="h-3 w-3" /> Chat
                      </Button>

                      {complaint.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex items-center gap-1"
                          onClick={() => openForwardDialog(complaint)}
                        >
                          <Forward className="h-3 w-3" /> Forward
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 w-full">
                    <div className="flex w-full">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-0 h-6 w-6 shrink-0 self-start mt-0.5"
                        onClick={() => {
                          setComplaints(
                            complaints.map((c) => (c.id === complaint.id ? { ...c, isExpanded: !c.isExpanded } : c)),
                          )
                        }}
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            complaint.isExpanded ? "transform rotate-180" : ""
                          }`}
                        />
                      </Button>
                      <div className="flex-1 min-w-0 pl-2">
                        <p
                          className={`text-sm break-words whitespace-pre-wrap ${
                            !complaint.isExpanded ? "line-clamp-1 overflow-hidden text-ellipsis" : ""
                          }`}
                        >
                          {complaint.description}
                        </p>
                      </div>
                    </div>
                  </div>
                  {complaint.assignedTo && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      Assigned to:{" "}
                      {facultyUsers.find((f) => f.id === complaint.assignedTo)
                        ? `${facultyUsers.find((f) => f.id === complaint.assignedTo)?.firstName || ""} ${
                            facultyUsers.find((f) => f.id === complaint.assignedTo)?.lastName || ""
                          } (ID: ${facultyUsers.find((f) => f.id === complaint.assignedTo)?.uniqueID || ""})`
                        : "Unknown Faculty"}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
            <p className="text-muted-foreground">No complaints found</p>
          </div>
        )}

        {/* Chat Dialog */}
        {selectedComplaintId && (
          <SimpleChatDialog
            open={chatDialogOpen}
            onOpenChange={setChatDialogOpen}
            complaintId={selectedComplaintId}
            complaintTitle={selectedComplaintTitle}
          />
        )}
      </CardContent>
    </Card>
  )
}
