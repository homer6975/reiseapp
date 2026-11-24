import * as React from "react";

import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-xl border bg-card p-4 text-card-foreground shadow-xs",
        className,
      )}
      {...props}
    />
  );
}

export { Card };
