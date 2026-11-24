import { requireParent } from "@/lib/auth";

// Nur Eltern (SPEC §2). Der Proxy liefert Kindern bereits 404, das hier ist die zweite Sicherung.
export default async function SettingsLayout({
  children,
}: LayoutProps<"/einstellungen">) {
  await requireParent();
  return <div className="space-y-6">{children}</div>;
}
