import type * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success: "border-transparent bg-green-500 text-white hover:bg-green-500/80",
        warning: "border-transparent bg-yellow-500 text-white hover:bg-yellow-500/80",
        info: "border-transparent bg-blue-500 text-white hover:bg-blue-500/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  // Apply explicit styles based on variant to ensure they work on all machines
  let explicitStyles = {}

  switch (variant) {
    case "success":
      explicitStyles = { backgroundColor: "#22c55e", color: "white" }
      break
    case "warning":
      explicitStyles = { backgroundColor: "#eab308", color: "white" }
      break
    case "info":
      explicitStyles = { backgroundColor: "#3b82f6", color: "white" }
      break
    case "destructive":
      explicitStyles = { backgroundColor: "#ef4444", color: "white" }
      break
    case "secondary":
      explicitStyles = { backgroundColor: "#f3f4f6", color: "#1f2937" }
      break
    case "default":
      explicitStyles = { backgroundColor: "#6366f1", color: "white" }
      break
    case "outline":
      explicitStyles = { backgroundColor: "transparent", color: "currentColor", borderColor: "currentColor" }
      break
  }

  return <div className={cn(badgeVariants({ variant }), className)} style={explicitStyles} {...props} />
}

export { Badge, badgeVariants }
