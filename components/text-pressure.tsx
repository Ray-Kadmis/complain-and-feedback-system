"use client"

import type React from "react"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface TextPressureProps {
  children: React.ReactNode
  className?: string
}

export function TextPressure({ children, className }: TextPressureProps) {
  const [pressed, setPressed] = useState(false)

  return (
    <span
      className={cn(
        "inline-block transition-all duration-300 ease-in-out",
        pressed ? "scale-95 opacity-70" : "scale-100 opacity-100",
        className,
      )}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
    >
      {children}
    </span>
  )
}
