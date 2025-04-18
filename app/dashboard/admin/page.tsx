"use client";

import type React from "react";
import Squares from "@/components/Squares";
import { useState, useEffect, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChevronDown, ExternalLink, Forward, Search } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  getDocs,
  getDoc,
  query,
  updateDoc,
  where,
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
  subcategory: string;
  description: string;
  username: string;
  semester?: string;
  status: string;
  createdAt: any;
  updatedAt: any;
  isExpanded?: boolean;
  assignedTo?: string;
  studentConfirmed?: boolean;
  studentResolutionResponse?: string;
};

type FacultyUser = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  uniqueID: string;
  department: string;
};

type StudentUser = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  uniqueID: string;
  department: string;
  program: string;
  batch: string;
  attending: string;
  academicYears: {
    start: string;
    end: string;
  };
  createdAt: string;
};

// Department options
const departments = [
  "Computer Science",
  "Information Technology",
  "Cyber Security",
  "Software Engineering",
  "Data Science",
  "Artificial Intelligence",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Business Administration",
];

// Program options
const programs = ["ADP", "BS", "Masters", "MPhil", "PhD"];

// Generate year options from current year - 10 to current year + 10
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [forwardingComplaint, setForwardingComplaint] =
    useState<Complaint | null>(null);
  const [selectedFaculty, setSelectedFaculty] = useState<string>("");
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [facultyUsers, setFacultyUsers] = useState<FacultyUser[]>([]);
  const [activeTab, setActiveTab] = useState("create-user");
  const [searchQuery, setSearchQuery] = useState("");
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [facultySearchQuery, setFacultySearchQuery] = useState("");
  const [resolvedComplaints, setResolvedComplaints] = useState<Complaint[]>([]);
  const [filteredResolvedComplaints, setFilteredResolvedComplaints] = useState<
    Complaint[]
  >([]);
  const [resolvedComplaintsLoaded, setResolvedComplaintsLoaded] =
    useState(false);

  // Basic user info
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [uniqueID, setUniqueID] = useState("");

  // Student specific fields
  const [department, setDepartment] = useState("");
  const [program, setProgram] = useState("");
  const [startYear, setStartYear] = useState(currentYear.toString());
  const [endYear, setEndYear] = useState((currentYear + 4).toString());
  const [batch, setBatch] = useState("fall");
  const [attending, setAttending] = useState("regular");

  // Lists
  const [users, setUsers] = useState<any[]>([]);
  const [studentUsers, setStudentUsers] = useState<StudentUser[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [indexError, setIndexError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Check if user is admin
        const userDoc = await getDoc(doc(db, `users/${user.uid}`));
        if (userDoc.exists() && userDoc.data()?.role === "admin") {
          setIsAdmin(true);
          fetchUsers();
          fetchComplaints();
          fetchFacultyUsers();
        } else {
          toast.error("Access denied", {
            description:
              "You don't have permission to access the admin dashboard.",
          });
          router.push("/");
        }
      } else {
        router.push("/login/admin");
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  // Load resolved complaints only when the resolved tab is selected
  useEffect(() => {
    if (activeTab === "resolved-complaints" && !resolvedComplaintsLoaded) {
      fetchResolvedComplaints();
    }
  }, [activeTab, resolvedComplaintsLoaded]);

  // Filter resolved complaints based on search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredResolvedComplaints(resolvedComplaints);
      return;
    }

    const lowerCaseQuery = searchQuery.toLowerCase();
    const filtered = resolvedComplaints.filter(
      (complaint) =>
        complaint.category.toLowerCase().includes(lowerCaseQuery) ||
        complaint.subcategory.toLowerCase().includes(lowerCaseQuery) ||
        complaint.title.toLowerCase().includes(lowerCaseQuery) ||
        complaint.description.toLowerCase().includes(lowerCaseQuery) ||
        complaint.username.toLowerCase().includes(lowerCaseQuery)
    );
    setFilteredResolvedComplaints(filtered);
  }, [searchQuery, resolvedComplaints]);

  const fetchUsers = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, "users"));
      const usersList = usersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Separate users by role
      const students = usersList.filter((user) => user.role === "student");
      const faculty = usersList.filter((user) => user.role === "faculty");

      setUsers(usersList);
      setStudentUsers(students as StudentUser[]);
      setFacultyUsers(faculty as FacultyUser[]);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchFacultyUsers = async () => {
    try {
      const q = query(collection(db, "users"), where("role", "==", "faculty"));
      const facultySnapshot = await getDocs(q);
      const facultyList = facultySnapshot.docs.map((doc) => ({
        id: doc.id,
        username: doc.data().username,
        firstName: doc.data().firstName || "",
        lastName: doc.data().lastName || "",
        uniqueID: doc.data().uniqueID || "",
        department: doc.data().department || "",
      }));
      setFacultyUsers(facultyList);
    } catch (error) {
      console.error("Error fetching faculty users:", error);
    }
  };

  const fetchComplaints = async () => {
    try {
      // Fetch non-resolved complaints
      const q = query(
        collection(db, "complaints"),
        where("status", "not-in", ["resolved"])
      );
      const complaintsSnapshot = await getDocs(q);
      const complaintsList: Complaint[] = [];

      complaintsSnapshot.forEach((doc) => {
        const data = doc.data();
        complaintsList.push({
          id: doc.id,
          title: data.title,
          category: data.category,
          subcategory: data.subcategory || "",
          description: data.description,
          username: data.username,
          semester: data.semester || "",
          status: data.status,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          isExpanded: false, // Initialize as collapsed
          assignedTo: data.assignedTo || null,
          studentConfirmed: data.studentConfirmed || false,
          studentResolutionResponse: data.studentResolutionResponse || "",
        });
      });

      // Sort in memory instead of using orderBy
      complaintsList.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );

      setComplaints(complaintsList);
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

  const fetchResolvedComplaints = async () => {
    try {
      setLoading(true);
      // Fetch only resolved complaints
      const q = query(
        collection(db, "complaints"),
        where("status", "==", "resolved")
      );
      const complaintsSnapshot = await getDocs(q);
      const resolvedList: Complaint[] = [];

      complaintsSnapshot.forEach((doc) => {
        const data = doc.data();
        resolvedList.push({
          id: doc.id,
          title: data.title,
          category: data.category,
          subcategory: data.subcategory || "",
          description: data.description,
          username: data.username,
          semester: data.semester || "",
          status: data.status,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          isExpanded: false,
          assignedTo: data.assignedTo || null,
          studentConfirmed: data.studentConfirmed || false,
          studentResolutionResponse: data.studentResolutionResponse || "",
        });
      });

      // Sort in memory instead of using orderBy
      resolvedList.sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
      );

      setResolvedComplaints(resolvedList);
      setFilteredResolvedComplaints(resolvedList);
      setResolvedComplaintsLoaded(true);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching resolved complaints:", error);
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        `${username}@university.edu`,
        password
      );

      // Prepare common user data
      const userData = {
        username,
        firstName,
        lastName,
        uniqueID,
        role,
        department,
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.uid,
      };

      // Add role-specific data
      if (role === "student") {
        Object.assign(userData, {
          program,
          academicYears: {
            start: startYear,
            end: endYear,
          },
          batch,
          attending,
        });
      }

      // Add user to Firestore with role
      await setDoc(doc(db, "users", userCredential.user.uid), userData);

      toast.success("User created successfully", {
        description: `New ${role} account created for ${firstName} ${lastName}. You can test these credentials later by logging out and logging back in as this user.`,
      });

      // Reset form
      resetForm();

      // Refresh user list
      fetchUsers();
      if (role === "faculty") {
        fetchFacultyUsers();
      }
    } catch (error: any) {
      toast.error("Error creating user", {
        description: error.message || "There was a problem creating the user.",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setUsername("");
    setPassword("");
    setFirstName("");
    setLastName("");
    setUniqueID("");
    setDepartment("");
    setProgram("");
    setStartYear(currentYear.toString());
    setEndYear((currentYear + 4).toString());
    setBatch("fall");
    setAttending("regular");
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

  const handleForwardComplaint = async () => {
    if (!forwardingComplaint || !selectedFaculty) {
      toast.error("Error", {
        description:
          "Please select a faculty member to forward this complaint to.",
      });
      return;
    }

    try {
      // Update the complaint in Firestore
      await updateDoc(doc(db, "complaints", forwardingComplaint.id), {
        status: "under review",
        assignedTo: selectedFaculty,
        updatedAt: new Date(),
      });

      // Update local state
      setComplaints(
        complaints.map((c) =>
          c.id === forwardingComplaint.id
            ? {
                ...c,
                status: "under review",
                assignedTo: selectedFaculty,
                updatedAt: new Date(),
              }
            : c
        )
      );

      // Show success message
      toast.success("Complaint forwarded", {
        description:
          "The complaint has been forwarded to the selected faculty member.",
      });

      // Close dialog and reset state
      setForwardDialogOpen(false);
      setForwardingComplaint(null);
      setSelectedFaculty("");
    } catch (error) {
      console.error("Error forwarding complaint:", error);
      toast.error("Error", {
        description:
          "There was a problem forwarding the complaint. Please try again.",
      });
    }
  };

  const openForwardDialog = (complaint: Complaint) => {
    setForwardingComplaint(complaint);
    setSelectedFaculty("");
    setForwardDialogOpen(true);
  };

  // Filter students based on search query
  const filteredStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return studentUsers;

    const query = studentSearchQuery.toLowerCase();
    return studentUsers.filter((student) =>
      student.username.toLowerCase().includes(query)
    );
  }, [studentUsers, studentSearchQuery]);

  // Filter faculty based on search query
  const filteredFaculty = useMemo(() => {
    if (!facultySearchQuery.trim()) return facultyUsers;

    const query = facultySearchQuery.toLowerCase();
    return facultyUsers.filter((faculty) =>
      faculty.username.toLowerCase().includes(query)
    );
  }, [facultyUsers, facultySearchQuery]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Will redirect in useEffect
  }

  return (
    <>
      <div className="fixed inset-0 -z-10 w-full h-full overflow-hidden">
        <Squares
          speed={0.5}
          squareSize={100}
          direction="diagonal" // up, down, left, right, diagonal
          borderColor="#ff0000"
          hoverFillColor="#750000"
        />
      </div>
      <div className="container mx-auto py-10 relative">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-4xl font-bold">Administrator Dashboard</h1>
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>

        <Tabs
          defaultValue="create-user"
          value={activeTab}
          onValueChange={setActiveTab}
          className="max-w-4xl mx-auto"
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="create-user">Create User</TabsTrigger>
            <TabsTrigger value="manage-users">Manage Users</TabsTrigger>
            <TabsTrigger value="view-complaints">View Complaints</TabsTrigger>
            <TabsTrigger value="resolved-complaints">
              Resolved Complaints
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create-user">
            <Card>
              <CardHeader>
                <CardTitle>Create New User</CardTitle>
                <CardDescription>
                  Create accounts for students and faculty members
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateUser} className="space-y-6">
                  {/* Role Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="role">User Role</Label>
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="faculty">Faculty</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Common Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Enter first name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Enter last name"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="uniqueID">Unique ID</Label>
                    <Input
                      id="uniqueID"
                      value={uniqueID}
                      onChange={(e) => setUniqueID(e.target.value)}
                      placeholder="Enter unique ID"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Select
                      value={department}
                      onValueChange={setDepartment}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem
                            key={dept}
                            value={dept.toLowerCase().replace(/\s+/g, "-")}
                          >
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Student-specific Fields */}
                  {role === "student" && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="program">Program</Label>
                        <Select
                          value={program}
                          onValueChange={setProgram}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select program" />
                          </SelectTrigger>
                          <SelectContent>
                            {programs.map((prog) => (
                              <SelectItem key={prog} value={prog.toLowerCase()}>
                                {prog}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="startYear">Starting Year</Label>
                          <Select
                            value={startYear}
                            onValueChange={setStartYear}
                            required
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select starting year" />
                            </SelectTrigger>
                            <SelectContent>
                              {years.map((year) => (
                                <SelectItem
                                  key={`start-${year}`}
                                  value={year.toString()}
                                >
                                  {year}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="endYear">Ending Year</Label>
                          <Select
                            value={endYear}
                            onValueChange={setEndYear}
                            required
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select ending year" />
                            </SelectTrigger>
                            <SelectContent>
                              {years.map((year) => (
                                <SelectItem
                                  key={`end-${year}`}
                                  value={year.toString()}
                                >
                                  {year}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Batch</Label>
                        <RadioGroup
                          value={batch}
                          onValueChange={setBatch}
                          className="flex space-x-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="fall" id="fall" />
                            <Label htmlFor="fall">Fall</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="spring" id="spring" />
                            <Label htmlFor="spring">Spring</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      <div className="space-y-2">
                        <Label>Attending</Label>
                        <RadioGroup
                          value={attending}
                          onValueChange={setAttending}
                          className="flex space-x-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="regular" id="regular" />
                            <Label htmlFor="regular">Regular</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="weekends" id="weekends" />
                            <Label htmlFor="weekends">Weekends</Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </>
                  )}

                  {/* Login Credentials */}
                  <div className="pt-4 border-t">
                    <h3 className="text-lg font-medium mb-4">
                      Login Credentials
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Enter username"
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Email will be {username}@university.edu
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter password"
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Password must be at least 6 characters
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating..." : "Create User"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manage-users">
            <Card>
              <CardHeader>
                <CardTitle>Manage Users</CardTitle>
                <CardDescription>
                  View and manage existing users
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="students" className="mb-6">
                  <TabsList>
                    <TabsTrigger value="students">Students</TabsTrigger>
                    <TabsTrigger value="faculty">Faculty</TabsTrigger>
                  </TabsList>

                  <TabsContent value="students" className="pt-4">
                    <div className="mb-4">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="search"
                          placeholder="Search students by username..."
                          className="pl-8"
                          value={studentSearchQuery}
                          onChange={(e) =>
                            setStudentSearchQuery(e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className="border rounded-md overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="p-3 text-left">Name</th>
                            <th className="p-3 text-left">Username</th>
                            <th className="p-3 text-left">Unique ID</th>
                            <th className="p-3 text-left">Department</th>
                            <th className="p-3 text-left">Program</th>
                            <th className="p-3 text-left">Batch</th>
                            <th className="p-3 text-left">Attending</th>
                            <th className="p-3 text-left">Starting Year</th>
                            <th className="p-3 text-left">Ending Year</th>
                            <th className="p-3 text-left">Created At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStudents.length > 0 ? (
                            filteredStudents.map((student) => (
                              <tr key={student.id} className="border-b">
                                <td className="p-3">{`${
                                  student.firstName || ""
                                } ${student.lastName || ""}`}</td>
                                <td className="p-3">{student.username}</td>
                                <td className="p-3">
                                  {student.uniqueID || "N/A"}
                                </td>
                                <td className="p-3 capitalize">
                                  {student.department?.replace(/-/g, " ") ||
                                    "N/A"}
                                </td>
                                <td className="p-3 capitalize">
                                  {student.program || "N/A"}
                                </td>
                                <td className="p-3 capitalize">
                                  {student.batch || "N/A"}
                                </td>
                                <td className="p-3 capitalize">
                                  {student.attending || "N/A"}
                                </td>
                                <td className="p-3">
                                  {student.academicYears?.start || "N/A"}
                                </td>
                                <td className="p-3">
                                  {student.academicYears?.end || "N/A"}
                                </td>
                                <td className="p-3">
                                  {new Date(
                                    student.createdAt
                                  ).toLocaleDateString()}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={10} className="p-3 text-center">
                                No students found
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>

                  <TabsContent value="faculty" className="pt-4">
                    <div className="mb-4">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="search"
                          placeholder="Search faculty by username..."
                          className="pl-8"
                          value={facultySearchQuery}
                          onChange={(e) =>
                            setFacultySearchQuery(e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className="border rounded-md overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="p-3 text-left">Name</th>
                            <th className="p-3 text-left">Username</th>
                            <th className="p-3 text-left">Unique ID</th>
                            <th className="p-3 text-left">Department</th>
                            <th className="p-3 text-left">Created At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredFaculty.length > 0 ? (
                            filteredFaculty.map((faculty) => (
                              <tr key={faculty.id} className="border-b">
                                <td className="p-3">{`${
                                  faculty.firstName || ""
                                } ${faculty.lastName || ""}`}</td>
                                <td className="p-3">{faculty.username}</td>
                                <td className="p-3">
                                  {faculty.uniqueID || "N/A"}
                                </td>
                                <td className="p-3 capitalize">
                                  {faculty.department?.replace(/-/g, " ") ||
                                    "N/A"}
                                </td>
                                <td className="p-3">
                                  {new Date(
                                    faculty.createdAt || Date.now()
                                  ).toLocaleDateString()}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="p-3 text-center">
                                No faculty found
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="view-complaints">
            <Card>
              <CardHeader>
                <CardTitle>All Complaints</CardTitle>
                <CardDescription>
                  View and manage all complaints in the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                {indexError && (
                  <Alert variant="destructive" className="mb-6">
                    <AlertTitle>Database Index Required</AlertTitle>
                    <AlertDescription className="flex flex-col gap-2">
                      <p>
                        A database index needs to be created for this feature to
                        work properly.
                      </p>
                      <p>
                        Please click the button below to create the required
                        index:
                      </p>
                      <Button
                        variant="outline"
                        className="w-fit flex items-center gap-2"
                        onClick={() => window.open(indexError, "_blank")}
                      >
                        Create Index <ExternalLink size={16} />
                      </Button>
                      <p className="text-sm">
                        After creating the index, please wait a few minutes and
                        then refresh this page.
                      </p>
                    </AlertDescription>
                  </Alert>
                )}

                {complaints.length > 0 ? (
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
                                variant={
                                  getStatusBadgeVariant(complaint.status) as any
                                }
                              >
                                {complaint.status === "awaiting confirmation"
                                  ? "Awaiting Confirmation"
                                  : complaint.status.charAt(0).toUpperCase() +
                                    complaint.status.slice(1)}
                              </Badge>
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
                                    complaints.map((c) =>
                                      c.id === complaint.id
                                        ? { ...c, isExpanded: !c.isExpanded }
                                        : c
                                    )
                                  );
                                }}
                              >
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform ${
                                    complaint.isExpanded
                                      ? "transform rotate-180"
                                      : ""
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
                          {complaint.assignedTo && (
                            <div className="mt-2 text-sm text-muted-foreground">
                              Assigned to:{" "}
                              {facultyUsers.find(
                                (f) => f.id === complaint.assignedTo
                              )
                                ? `${
                                    facultyUsers.find(
                                      (f) => f.id === complaint.assignedTo
                                    )?.firstName || ""
                                  } ${
                                    facultyUsers.find(
                                      (f) => f.id === complaint.assignedTo
                                    )?.lastName || ""
                                  } (ID: ${
                                    facultyUsers.find(
                                      (f) => f.id === complaint.assignedTo
                                    )?.uniqueID || ""
                                  })`
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resolved-complaints">
            <Card>
              <CardHeader>
                <CardTitle>Resolved Complaints</CardTitle>
                <CardDescription>
                  View all resolved complaints in the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search by category, student ID, or keywords..."
                      className="pl-8"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                {loading ? (
                  <div className="text-center py-10">
                    Loading resolved complaints...
                  </div>
                ) : filteredResolvedComplaints.length > 0 ? (
                  <div className="space-y-4">
                    {filteredResolvedComplaints.map((complaint) => (
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
                                \{" "}
                                {complaint.subcategory.charAt(0).toUpperCase() +
                                  complaint.subcategory.slice(1)}{" "}
                                • Submitted by: {complaint.username} • Semester:{" "}
                                {complaint.semester || "N/A"} • Resolved:{" "}
                                {complaint.updatedAt.toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="success">Resolved</Badge>
                              {complaint.studentConfirmed && (
                                <Badge variant="outline">
                                  {complaint.studentResolutionResponse ===
                                  "confirmed"
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
                                onClick={() => {
                                  setFilteredResolvedComplaints(
                                    filteredResolvedComplaints.map((c) =>
                                      c.id === complaint.id
                                        ? { ...c, isExpanded: !c.isExpanded }
                                        : c
                                    )
                                  );
                                }}
                              >
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform ${
                                    complaint.isExpanded
                                      ? "transform rotate-180"
                                      : ""
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
                          {complaint.assignedTo && (
                            <div className="mt-2 text-sm text-muted-foreground">
                              Resolved by:{" "}
                              {facultyUsers.find(
                                (f) => f.id === complaint.assignedTo
                              )
                                ? `${
                                    facultyUsers.find(
                                      (f) => f.id === complaint.assignedTo
                                    )?.firstName || ""
                                  } ${
                                    facultyUsers.find(
                                      (f) => f.id === complaint.assignedTo
                                    )?.lastName || ""
                                  } (ID: ${
                                    facultyUsers.find(
                                      (f) => f.id === complaint.assignedTo
                                    )?.uniqueID || ""
                                  })`
                                : "Unknown Faculty"}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <p className="text-muted-foreground">
                      No resolved complaints found
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Forward Complaint Dialog */}
        <Dialog open={forwardDialogOpen} onOpenChange={setForwardDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Forward Complaint</DialogTitle>
              <DialogDescription>
                Select a faculty member to forward this complaint to. The
                complaint status will be updated to "Under Review".
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="faculty">Select Faculty</Label>
                <Select
                  value={selectedFaculty}
                  onValueChange={setSelectedFaculty}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select faculty member" />
                  </SelectTrigger>
                  <SelectContent>
                    {facultyUsers.length > 0 ? (
                      facultyUsers.map((faculty) => (
                        <SelectItem key={faculty.id} value={faculty.id}>
                          {faculty.firstName} {faculty.lastName} (ID:{" "}
                          {faculty.uniqueID})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No faculty members available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              {forwardingComplaint && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Complaint:</p>
                  <p className="text-sm">{forwardingComplaint.title}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setForwardDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleForwardComplaint}
                disabled={!selectedFaculty}
              >
                Forward Complaint
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
