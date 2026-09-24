import { AppShell } from "@/components/app-shell/app-shell";

/** Signed-in area: five sections behind the middleware gate share one shell. */
export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
