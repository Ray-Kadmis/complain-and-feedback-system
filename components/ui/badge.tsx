import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success:
          "border-transparent bg-green-500 text-white hover:bg-green-500/80",
        warning:
          "border-transparent bg-yellow-500 text-white hover:bg-yellow-500/80",
        info: "border-transparent bg-blue-500 text-white hover:bg-blue-500/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  // Apply explicit styles based on variant to ensure they work on all machines
  let explicitStyles = {};

  switch (variant) {
    case "success":
      explicitStyles = {
        backgroundColor: "#15803d",
        color: "white",
        fontWeight: "bold",
      }; // Darker green
      break;
    case "warning":
      explicitStyles = {
        backgroundColor: "#ca8a04",
        color: "white",
        fontWeight: "bold",
      }; // Darker yellow
      break;
    case "info":
      explicitStyles = {
        backgroundColor: "#0369a1",
        color: "white",
        fontWeight: "bold",
      }; // Darker blue
      break;
    case "destructive":
      explicitStyles = {
        backgroundColor: "#b91c1c",
        color: "white",
        fontWeight: "bold",
      }; // Darker red
      break;
    case "secondary":
      explicitStyles = {
        backgroundColor: "#e5e7eb",
        color: "#1f2937",
        fontWeight: "bold",
      };
      break;
    case "default":
      explicitStyles = {
        backgroundColor: "#4f46e5",
        color: "white",
        fontWeight: "bold",
      }; // Darker indigo
      break;
    case "outline":
      explicitStyles = {
        backgroundColor: "transparent",
        color: "currentColor",
        borderColor: "currentColor",
        fontWeight: "bold",
      };
      break;
  }

  return (
    <div
      className={cn(badgeVariants({ variant }), className)}
      style={explicitStyles}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
