import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getMe } from "@/lib/auth";
import { signOut } from "@/server/actions/auth";

export async function UserMenu() {
  const me = await getMe();
  return (
    <form action={signOut} className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{me.displayName}</span>
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label="Abmelden"
        title="Abmelden"
      >
        <LogOut />
      </Button>
    </form>
  );
}
