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
    const height = size === "sm" ? "h-1.5" : "h-2.5";
    const clamped = Math.min(100, Math.max(0, value));

    return (
      <div
        ref={ref}
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-zinc-900/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)] border border-white/5",
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
            "h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 relative",
            animated && "animate-flow bg-[length:200%_100%]"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {/* Edge Glow */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/40 to-transparent blur-[2px]" />
          
          {/* Shimmer overlay while downloading */}
          {animated && (
            <div
              className="absolute inset-0 animate-shimmer mix-blend-overlay"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
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
