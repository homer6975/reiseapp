import { getMe } from "@/lib/auth";

import { BottomNavLinks, type NavItem } from "./bottom-nav-links";

const items: (NavItem & { parentOnly: boolean })[] = [
  { href: "/", label: "Start", parentOnly: false },
  { href: "/jahr", label: "Jahr", parentOnly: false },
  { href: "/reisen", label: "Reisen", parentOnly: false },
  { href: "/einstellungen", label: "Einstellungen", parentOnly: true },
];

// Kinder sehen keine Einstellungen (SPEC §2).
export async function BottomNav() {
  const me = await getMe();
  const visible = items
    .filter((i) => me.isParent || !i.parentOnly)
    .map(({ href, label }) => ({ href, label }));
  return <BottomNavLinks items={visible} />;
}
