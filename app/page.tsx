"use client";
import Waves from "@/components/BgWaves";
import TextPressure from "@/components/TextPressure";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
const firebaseConfig = {
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

export default function Home() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in, check their role
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          // Redirect to appropriate dashboard
          router.push(`/dashboard/${userData.role}`);
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleRoleSelect = (role: string) => {
    setSelectedRole(role);
    router.push(`/login/${role}`);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      {/* Container with flex-col to stack items vertically */}
      <div className="absolute inset-0 w-full h-full z-0">
        <Waves
          lineColor="#005B94"
          backgroundColor="rgba(255, 255, 255, 0)"
          waveSpeedX={0.1}
          waveSpeedY={0.1}
          waveAmpX={60}
          waveAmpY={50}
          friction={0.9}
          tension={0.01}
          maxCursorMove={120}
          xGap={12}
          yGap={12}
        />
      </div>
      <div className="w-full z-10 max-w-4xl relative">
        {/* TextPressure takes full width */}
        <div className="md:mb-12 lg:mb-0 lg:absolute lg:inset-0 lg:z-0 lg:flex lg:flex-col lg:justify-center lg:items-center">
          <div className="w-screen  flex justify-center">
            <TextPressure
              text="U.S.P Complaint"
              textColor="#ffffff"
              strokeColor="#00bfff"
              className="w-full text-center lg:mix-blend-difference"
              minFontSize={6}
            />
          </div>
          <div className="w-screen flex justify-center mt-2">
            <TextPressure
              text="& Feedback System"
              textColor="#ffffff"
              strokeColor="#00bfff"
              className="w-full text-center  lg:mix-blend-difference"
              minFontSize={5}
            />
          </div>
        </div>

        {/* Card that will be in front on large screens */}
        <div className="relative lg:z-10 w-full flex justify-center mt-12 lg:mt-0">
          <Card className="w-full max-w-md mx-10 bg-transparent backdrop-blur-lg">
            <CardHeader className="text-center  justify-center">
              <CardDescription className="text-white">
                Please select your role to continue
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Button
                variant="outline"
                className="h-16 text-lg transition-all duration-200 ease-in-out hover:scale-105 hover:shadow-[0_0_20px_rgba(74,222,128,0.5)] hover:border-green-400 hover:border-4"
                onClick={() => handleRoleSelect("student")}
              >
                Student
              </Button>
              <Button
                variant="outline"
                className="h-16 text-lg transition-all duration-200 ease-in-out hover:scale-105 hover:shadow-[0_0_20px_rgba(250,204,21,0.5)] hover:border-yellow-300 hover:border-4"
                onClick={() => handleRoleSelect("faculty")}
              >
                Faculty
              </Button>
              <Button
                variant="outline"
                className="h-16 text-lg transition-all duration-200 ease-in-out hover:scale-105 hover:shadow-[0_0_20px_rgba(0,128,255,0.5)] hover:border-blue-400 hover:border-4"
                onClick={() => handleRoleSelect("admin")}
              >
                Administrator
              </Button>
            </CardContent>
            <CardFooter className="text-center text-white text-sm justify-center">
              Select your role to access the appropriate login page
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
