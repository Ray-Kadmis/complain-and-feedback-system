"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Toaster } from "sonner"

export function Providers({ children }: { children: React.ReactNode }) {
  // Use this to prevent hydration mismatch
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <>
      {children}
      {/* Only render Toaster on the client after hydration */}
      {mounted && <Toaster position="top-right" richColors />}
    </>
  )
}
