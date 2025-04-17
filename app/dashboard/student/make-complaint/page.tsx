"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { initializeApp } from "firebase/app"
import { getAuth, onAuthStateChanged } from "firebase/auth"
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

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

export default function MakeComplaint() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [semester, setSemester] = useState("1")
  const [studentDepartment, setStudentDepartment] = useState("")
  const [subcategory, setSubcategory] = useState("")

  // Categories and subcategories mapping
  const categoryOptions = [
    "Academic",
    "Health and Safety",
    "Technology and Digital",
    "Student Life and Extracurricular",
    "Disciplinary and Behavioral",
    "Facilities and Infrastructure",
    "Administrative",
  ]

  const subcategoryMap: Record<string, string[]> = {
    academic: [
      "Unfair grading",
      "Incompetent faculty",
      "Lack of academic support",
      "Course content issues",
      "Unreasonable workload",
    ],
    "health and safety": [
      "Unsafe conditions",
      "Health services issues",
      "Mental health support",
      "Emergency response",
      "COVID-19 protocols",
    ],
    "technology and digital": [
      "Wi-Fi connectivity",
      "Learning management system",
      "Computer lab issues",
      "Software access",
      "IT support",
    ],
    "student life and extracurricular": [
      "Club/organization issues",
      "Event planning problems",
      "Discrimination in activities",
      "Lack of opportunities",
      "Funding issues",
    ],
    "disciplinary and behavioral": [
      "Unfair punishment",
      "Bullying/harassment",
      "Code of conduct issues",
      "Reporting process",
      "Appeal process",
    ],
    "facilities and infrastructure": [
      "Classroom conditions",
      "Dormitory issues",
      "Cafeteria/food quality",
      "Accessibility concerns",
      "Maintenance problems",
    ],
    administrative: [
      "Registration issues",
      "Financial aid problems",
      "Transcript errors",
      "Scheduling conflicts",
      "Staff responsiveness",
    ],
  }

  // Departments list
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
  ]

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid)

        // Get username from Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid))
        if (userDoc.exists()) {
          setUsername(userDoc.data().username)
          // Set the student's department if available
          if (userDoc.data().department) {
            setStudentDepartment(userDoc.data().department)
          }
        } else {
          router.push("/login/student")
        }
      } else {
        router.push("/login/student")
      }
    })

    return () => unsubscribe()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!userId || !username) {
      toast.error("Authentication error", {
        description: "You must be logged in to submit a complaint.",
      })
      return
    }

    setLoading(true)

    try {
      // Add complaint to Firestore
      await addDoc(collection(db, "complaints"), {
        title,
        category,
        subcategory,
        semester,
        department: studentDepartment,
        description,
        userId,
        username,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      toast.success("Complaint submitted", {
        description: "Your complaint has been submitted successfully.",
      })

      // Reset form
      setTitle("")
      setCategory("")
      setSubcategory("")
      setDescription("")

      // Redirect to dashboard
      router.push("/dashboard/student")
    } catch (error: any) {
      console.error("Error submitting complaint:", error)
      toast.error("Error submitting complaint", {
        description: error.message || "There was a problem submitting your complaint.",
      })
    } finally {
      setLoading(false)
    }
  }

  // Reset subcategory when category changes
  useEffect(() => {
    setSubcategory("")
  }, [category])

  return (
    <div className="container mx-auto py-10">
      <Button variant="outline" onClick={() => router.push("/dashboard/student")} className="mb-6">
        Back to Dashboard
      </Button>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Submit a Complaint</CardTitle>
          <CardDescription>Please provide details about your complaint or feedback</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Complaint Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                placeholder="Brief title for your complaint"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((cat) => (
                    <SelectItem key={cat} value={cat.toLowerCase()}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {category && (
              <div className="space-y-2">
                <Label htmlFor="subcategory">Subcategory</Label>
                <Select value={subcategory} onValueChange={setSubcategory} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subcategory" />
                  </SelectTrigger>
                  <SelectContent>
                    {subcategoryMap[category]?.map((subcat) => (
                      <SelectItem key={subcat} value={subcat.toLowerCase()}>
                        {subcat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="semester">Semester</Label>
              <RadioGroup value={semester} onValueChange={setSemester} className="flex flex-wrap gap-2">
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} className="flex items-center space-x-1">
                    <RadioGroupItem value={(i + 1).toString()} id={`semester-${i + 1}`} />
                    <Label htmlFor={`semester-${i + 1}`}>{i + 1}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select value={studentDepartment} onValueChange={setStudentDepartment} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept.toLowerCase().replace(/\s+/g, "-")}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                placeholder="Provide detailed information about your complaint"
                className="min-h-[150px]"
                required
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Submitting..." : "Submit Complaint"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
