"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  FirestoreError,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { MessageSquare } from "lucide-react";
import { SimpleChatDialog } from "@/components/chat/simple-chat-dialog";
import Squares from "@/components/Squares";
// Firebase configuration
const firebaseConfig = {
  // Your Firebase config here
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

type Complaint = {
  id: string;
  title: string;
  category: string;
  subcategory: string;
  description: string;
  username: string;
  userId: string;
  semester?: string;
  status: string;
  createdAt: any;
  updatedAt: any;
  isExpanded?: boolean;
  assignedTo?: string;
  studentConfirmed?: boolean;
  studentResolutionResponse?: string;
  department?: string;
};

export default function FacultyDashboard() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [isFaculty, setIsFaculty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [facultyId, setFacultyId] = useState<string | null>(null);
  const [receivedComplaints, setReceivedComplaints] = useState<Complaint[]>([]);
  const [activeComplaints, setActiveComplaints] = useState<Complaint[]>([]);
  const [resolvedComplaints, setResolvedComplaints] = useState<Complaint[]>([]);
  const [awaitingConfirmationComplaints, setAwaitingConfirmationComplaints] =
    useState<Complaint[]>([]);
  const [indexError, setIndexError] = useState<string | null>(null);

  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(
    null
  );
  const [selectedComplaintTitle, setSelectedComplaintTitle] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Check if user is faculty
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data()?.role === "faculty") {
          setIsFaculty(true);
          setUsername(userDoc.data()?.username || "");
          setFacultyId(user.uid);
          fetchComplaints(user.uid);
        } else {
          toast.error("Access denied", {
            description:
              "You don't have permission to access the faculty dashboard.",
          });
          router.push("/");
        }
      } else {
        router.push("/login/faculty");
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const fetchComplaints = async (userId: string) => {
    try {
      // Fetch complaints assigned to this faculty
      const q = query(
        collection(db, "complaints"),
        where("assignedTo", "==", userId)
      );
      const complaintsSnapshot = await getDocs(q);

      const received: Complaint[] = [];
      const active: Complaint[] = [];
      const resolved: Complaint[] = [];
      const awaitingConfirmation: Complaint[] = [];

      complaintsSnapshot.forEach((doc) => {
        const data = doc.data();
        const complaint = {
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
          assignedTo: data.assignedTo,
          studentConfirmed: data.studentConfirmed || false,
          studentResolutionResponse: data.studentResolutionResponse || "",
        };

        // Sort complaints by status
        if (data.status === "under review") {
          received.push(complaint);
        } else if (data.status === "active") {
          active.push(complaint);
        } else if (data.status === "resolved") {
          resolved.push(complaint);
        } else if (data.status === "awaiting confirmation") {
          awaitingConfirmation.push(complaint);
        }
      });

      // Sort by date (newest first)
      received.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      active.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      resolved.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      awaitingConfirmation.sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
      );

      setReceivedComplaints(received);
      setActiveComplaints(active);
      setResolvedComplaints(resolved);
      setAwaitingConfirmationComplaints(awaitingConfirmation);
      setIndexError(null);
    } catch (error) {
      console.error("Error fetching complaints:", error);

      // Check if it's an index error
      if (
        error instanceof FirestoreError &&
        error.code === "failed-precondition"
      ) {
        const match = error.message.match(
          /https:\/\/console\.firebase\.google\.com[^\s]+/
        );
        if (match) {
          setIndexError(match[0]);
        } else {
          setIndexError("https://console.firebase.google.com");
        }
      }
    }
  };

  // Function to delete all chat messages for a complaint
  const deleteComplaintChats = async (complaintId: string) => {
    try {
      // Query all chat messages for this complaint
      const chatQuery = query(
        collection(db, "chats"),
        where("complaintId", "==", complaintId)
      );
      const chatSnapshot = await getDocs(chatQuery);

      // Delete each chat message
      const deletePromises = chatSnapshot.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      console.log(
        `Deleted ${chatSnapshot.size} chat messages for complaint ${complaintId}`
      );
    } catch (error) {
      console.error("Error deleting chat messages:", error);
    }
  };

  const handleStatusChange = async (complaintId: string, newStatus: string) => {
    try {
      // Update the complaint status in Firestore
      await updateDoc(doc(db, "complaints", complaintId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      // If the complaint is being marked as resolved or awaiting confirmation, delete its chat messages
      if (newStatus === "resolved" || newStatus === "awaiting confirmation") {
        // We'll delete chat messages when the complaint is marked as awaiting confirmation
        // This is because at this point, the faculty considers the issue resolved
        await deleteComplaintChats(complaintId);
      }

      // Update local state
      if (newStatus === "active") {
        // Move from received to active
        const complaint = receivedComplaints.find((c) => c.id === complaintId);
        if (complaint) {
          const updatedComplaint = {
            ...complaint,
            status: newStatus,
            updatedAt: new Date(),
          };
          setReceivedComplaints(
            receivedComplaints.filter((c) => c.id !== complaintId)
          );
          setActiveComplaints([updatedComplaint, ...activeComplaints]);
        }
      } else if (newStatus === "awaiting confirmation") {
        // Move from active to awaiting confirmation
        const complaint = activeComplaints.find((c) => c.id === complaintId);
        if (complaint) {
          const updatedComplaint = {
            ...complaint,
            status: newStatus,
            updatedAt: new Date(),
          };
          setActiveComplaints(
            activeComplaints.filter((c) => c.id !== complaintId)
          );
          setAwaitingConfirmationComplaints([
            updatedComplaint,
            ...awaitingConfirmationComplaints,
          ]);
        }
      }

      toast.success("Status updated", {
        description: `Complaint status has been updated to ${newStatus.replace(
          /-/g,
          " "
        )}.`,
      });
    } catch (error) {
      console.error("Error updating complaint status:", error);
      toast.error("Error", {
        description:
          "There was a problem updating the complaint status. Please try again.",
      });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "pending":
        return "secondary";
      case "under review":
        return "warning";
      case "active":
        return "default";
      case "in-progress":
        return "default";
      case "awaiting confirmation":
        return "info";
      case "resolved":
        return "success";
      case "rejected":
        return "destructive";
      default:
        return "outline";
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const toggleExpand = (
    complaintsList: Complaint[],
    setComplaintsList: React.Dispatch<React.SetStateAction<Complaint[]>>,
    id: string
  ) => {
    setComplaintsList(
      complaintsList.map((c) =>
        c.id === id ? { ...c, isExpanded: !c.isExpanded } : c
      )
    );
  };

  const handleOpenChat = (complaint: Complaint) => {
    setSelectedComplaintId(complaint.id);
    setSelectedComplaintTitle(complaint.title);
    setChatDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!isFaculty) {
    return null; // Will redirect in useEffect
  }

  const renderComplaintsList = (
    complaints: Complaint[],
    setComplaints: React.Dispatch<React.SetStateAction<Complaint[]>>,
    showActionButton = false,
    actionButtonText = "",
    onAction: (id: string) => void = () => {},
    showChatButton = false
  ) => {
    return complaints.length > 0 ? (
      <div className="space-y-4">
        {complaints.map((complaint) => (
          <Card key={complaint.id}>
            <CardContent className="pt-6">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-lg">{complaint.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {complaint.category.charAt(0).toUpperCase() +
                      complaint.category.slice(1)}{" "}
                    \{" "}
                    {complaint.subcategory.charAt(0).toUpperCase() +
                      complaint.subcategory.slice(1)}{" "}
                    • Submitted by: {complaint.username} • Semester:{" "}
                    {complaint.semester || "N/A"} • Date:{" "}
                    {complaint.createdAt.toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={getStatusBadgeVariant(complaint.status) as any}
                  >
                    {complaint.status === "awaiting confirmation"
                      ? "Awaiting Confirmation"
                      : complaint.status.charAt(0).toUpperCase() +
                        complaint.status.slice(1)}
                  </Badge>

                  {/* Chat button - only show for active complaints */}
                  {showChatButton && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-1"
                      onClick={() => handleOpenChat(complaint)}
                    >
                      <MessageSquare className="h-3 w-3" /> Chat
                    </Button>
                  )}

                  {/* Action button (Mark as Active/Resolved) */}
                  {showActionButton && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAction(complaint.id)}
                    >
                      {actionButtonText}
                    </Button>
                  )}

                  {complaint.status === "resolved" &&
                    complaint.studentResolutionResponse && (
                      <Badge
                        variant={
                          complaint.studentResolutionResponse === "confirmed"
                            ? "success"
                            : "destructive"
                        }
                      >
                        {complaint.studentResolutionResponse === "confirmed"
                          ? "Student Confirmed"
                          : "Student Rejected"}
                      </Badge>
                    )}
                </div>
              </div>
              <div className="mt-2 w-full">
                <div className="flex w-full">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-0 h-6 w-6 shrink-0 self-start mt-0.5"
                    onClick={() =>
                      toggleExpand(complaints, setComplaints, complaint.id)
                    }
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
                        !complaint.isExpanded
                          ? "line-clamp-1 overflow-hidden text-ellipsis"
                          : ""
                      }`}
                    >
                      {complaint.description}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    ) : (
      <div className="text-center py-10">
        <p className="text-muted-foreground">No complaints found</p>
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 -z-10 w-full h-full overflow-hidden">
        <Squares
          speed={0.5}
          squareSize={100}
          direction="diagonal" // up, down, left, right, diagonal
          borderColor="#ffea00"
          hoverFillColor="#ffea00"
        />
      </div>
      <div className="container mx-auto py-10">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-4xl font-bold">Faculty Dashboard</h1>
          <div className="flex items-center gap-4">
            <span>Welcome, {username}</span>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>

        <Tabs defaultValue="received" className="max-w-4xl mx-auto">
          <TabsList className="flex flex-wrap w-full gap-2 mb-2 min-h-fit">
            <TabsTrigger value="received" className="flex-grow md:flex-grow-0">
              Received Complaints
            </TabsTrigger>
            <TabsTrigger value="active" className="flex-grow md:flex-grow-0">
              Active Complaints
            </TabsTrigger>
            <TabsTrigger value="awaiting" className="flex-grow md:flex-grow-0">
              Awaiting Confirmation
            </TabsTrigger>
            <TabsTrigger value="resolved" className="flex-grow md:flex-grow-0">
              Resolved Complaints
            </TabsTrigger>
          </TabsList>

          <TabsContent value="received">
            <Card>
              <CardHeader>
                <CardTitle>Received Complaints</CardTitle>
                <CardDescription>
                  Complaints that have been forwarded to you for review
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderComplaintsList(
                  receivedComplaints,
                  setReceivedComplaints,
                  true,
                  "Mark as Active",
                  (id) => handleStatusChange(id, "active")
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="active">
            <Card>
              <CardHeader>
                <CardTitle>Active Complaints</CardTitle>
                <CardDescription>
                  Complaints you are currently working on
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderComplaintsList(
                  activeComplaints,
                  setActiveComplaints,
                  true,
                  "Mark as Resolved",
                  (id) => handleStatusChange(id, "awaiting confirmation"),
                  true // Show chat button only for active complaints
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="awaiting">
            <Card>
              <CardHeader>
                <CardTitle>Awaiting Confirmation</CardTitle>
                <CardDescription>
                  Complaints waiting for student confirmation
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderComplaintsList(
                  awaitingConfirmationComplaints,
                  setAwaitingConfirmationComplaints
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resolved">
            <Card>
              <CardHeader>
                <CardTitle>Resolved Complaints</CardTitle>
                <CardDescription>
                  Complaints that have been resolved
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderComplaintsList(
                  resolvedComplaints,
                  setResolvedComplaints
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {selectedComplaintId && (
          <SimpleChatDialog
            open={chatDialogOpen}
            onOpenChange={setChatDialogOpen}
            complaintId={selectedComplaintId}
            complaintTitle={selectedComplaintTitle}
          />
        )}
      </div>
    </>
  );
}
