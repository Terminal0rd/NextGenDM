import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0-100 percentage value */
  value: number;
  /** Whether to show shimmer animation (true while downloading) */
  animated?: boolean;
  /** Size variant */
  size?: "sm" | "default";
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, animated = false, size = "default", ...props }, ref) => {
    const height = size === "sm" ? "h-1.5" : "h-2";
    const clamped = Math.min(100, Math.max(0, value));

    return (
      <div
        ref={ref}
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-zinc-800",
          height,
          className
        )}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        {...props}
      >
        <motion.div
          className={cn(
            "h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600",
            animated && "relative overflow-hidden"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {/* Shimmer overlay while downloading */}
          {animated && (
            <div
              className="absolute inset-0 animate-shimmer"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
                backgroundSize: "200% 100%",
              }}
            />
          )}
        </motion.div>
      </div>
    );
  }
);
Progress.displayName = "Progress";

export { Progress };
