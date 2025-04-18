"use client";
import Squares from "@/components/Squares";
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExternalLink } from "lucide-react";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  FirestoreError,
} from "firebase/firestore";

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
  status: string;
  createdAt: any;
  updatedAt: any;
  description: string;
};

export default function PreviousComplaints() {
  const router = useRouter();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [indexError, setIndexError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await fetchPreviousComplaints(user.uid);
      } else {
        router.push("/login/student");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const fetchPreviousComplaints = async (userId: string) => {
    try {
      // Use a simpler query without orderBy to avoid index issues
      const q = query(
        collection(db, "complaints"),
        where("userId", "==", userId),
        where("status", "in", ["resolved", "rejected"])
      );

      const querySnapshot = await getDocs(q);
      const complaintsData: Complaint[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        complaintsData.push({
          id: doc.id,
          title: data.title,
          category: data.category,
          status: data.status,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          description: data.description,
        });
      });

      // Sort the results in memory instead of using orderBy
      complaintsData.sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
      );

      setComplaints(complaintsData);
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

      toast.error("Error", {
        description: "Failed to load complaints. Please try again.",
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

  return (
    <>
      <div className="fixed inset-0 -z-10 w-full h-full overflow-hidden">
        <Squares
          speed={0.5}
          squareSize={100}
          direction="diagonal" // up, down, left, right, diagonal
          borderColor="#00b3ff"
          hoverFillColor="#00b3ff"
        />
      </div>
      <div className="container mx-auto py-10">
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard/student")}
          className="mb-6"
        >
          Back to Dashboard
        </Button>

        {indexError && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Database Index Required</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <p>
                A database index needs to be created for this feature to work
                properly.
              </p>
              <p>Please click the button below to create the required index:</p>
              <Button
                variant="outline"
                className="w-fit flex items-center gap-2"
                onClick={() => window.open(indexError, "_blank")}
              >
                Create Index <ExternalLink size={16} />
              </Button>
              <p className="text-sm">
                After creating the index, please wait a few minutes and then
                refresh this page.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Previous Complaints</CardTitle>
            <CardDescription>View your complaint history</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-10">Loading...</div>
            ) : complaints.length > 0 ? (
              <div className="space-y-4">
                {complaints.map((complaint) => (
                  <Card key={complaint.id}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold text-lg">
                            {complaint.title}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {complaint.category.charAt(0).toUpperCase() +
                              complaint.category.slice(1)}{" "}
                            • Submitted:{" "}
                            {complaint.createdAt.toLocaleDateString()} •
                            Resolved: {complaint.updatedAt.toLocaleDateString()}
                          </p>
                        </div>
                        <Badge
                          variant={
                            getStatusBadgeVariant(complaint.status) as any
                          }
                        >
                          {complaint.status.charAt(0).toUpperCase() +
                            complaint.status.slice(1)}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm">{complaint.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <p className="text-muted-foreground">
                  You don't have any previous complaints
                </p>
                <Button
                  className="mt-4"
                  onClick={() =>
                    router.push("/dashboard/student/make-complaint")
                  }
                >
                  Make a Complaint
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
