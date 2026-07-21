import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 focus-visible:border-cyan-500/50 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
