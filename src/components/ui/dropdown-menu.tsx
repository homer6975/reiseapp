"use client";

import * as React from "react";
import { DropdownMenu as Menu } from "radix-ui";

import { cn } from "@/lib/utils";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

const contentClass =
  "z-50 max-h-[60dvh] min-w-44 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md";

export function DropdownMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        sideOffset={4}
        align="end"
        className={cn(contentClass, className)}
        {...props}
      />
    </Menu.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof Menu.Item>) {
  return (
    <Menu.Item
      className={cn(
        "flex min-h-10 cursor-default items-center gap-2 rounded-sm px-2 text-sm outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof Menu.Label>) {
  return (
    <Menu.Label
      className={cn(
        "mt-1 border-t px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
