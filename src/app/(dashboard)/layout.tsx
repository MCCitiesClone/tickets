import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getActiveGuild } from "@/lib/active-guild";
import { requireSession } from "@/lib/session";
import { AppSidebar } from "./app-sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Real auth check (the proxy.ts cookie check is only optimistic).
  const session = await requireSession();
  const { guilds, active } = await getActiveGuild();

  return (
    <SidebarProvider>
      <AppSidebar
        user={{ name: session.user.name, image: session.user.image }}
        guilds={guilds}
        activeGuildId={active?.id ?? null}
      />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <span className="text-sm font-medium text-muted-foreground">
            Dashboard
          </span>
        </header>
        <div className="flex-1 p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
