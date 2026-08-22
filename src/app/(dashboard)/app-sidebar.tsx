"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Ban,
  BarChart3,
  BellRing,
  BookOpen,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  MessageSquare,
  MessageSquareText,
  PanelsTopLeft,
  ScrollText,
  Settings,
  Ticket,
  TicketCheck,
} from "lucide-react";
import { toast } from "sonner";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { signOut } from "@/lib/auth-client";
import type { ManageableGuild } from "@/lib/guild-access";
import { GuildSelector } from "./guild-selector";

type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { title: "My tickets", href: "/dashboard/my-tickets", icon: TicketCheck },
  { title: "Panels", href: "/dashboard/panels", icon: PanelsTopLeft },
  { title: "Tickets", href: "/dashboard/tickets", icon: Ticket },
  { title: "Stats", href: "/dashboard/stats", icon: BarChart3 },
  { title: "Messages", href: "/dashboard/messages", icon: MessageSquare },
  {
    title: "Canned responses",
    href: "/dashboard/canned-responses",
    icon: MessageSquareText,
  },
  { title: "On call", href: "/dashboard/on-call", icon: BellRing },
  { title: "Blacklist", href: "/dashboard/blacklist", icon: Ban },
  { title: "Audit log", href: "/dashboard/audit", icon: ScrollText },
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function AppSidebar({
  user,
  guilds,
  activeGuildId,
}: {
  user: { name: string; image?: string | null };
  guilds: ManageableGuild[];
  activeGuildId: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    try {
      await signOut();
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Could not sign out. Please try again.");
    }
  }

  return (
    <Sidebar>
      <SidebarHeader className="gap-2">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Ticket className="size-5" />
          <span className="font-semibold">Tickets</span>
        </div>
        <GuildSelector guilds={guilds} activeGuildId={activeGuildId} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={
                    item.href === "/dashboard"
                      ? pathname === item.href
                      : pathname.startsWith(item.href)
                  }
                  tooltip={item.title}
                  render={<Link href={item.href} />}
                >
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Documentation"
              render={<Link href="/docs" />}
            >
              <BookOpen />
              <span>Documentation</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Avatar className="size-7">
                {user.image ? <AvatarImage src={user.image} alt="" /> : null}
                <AvatarFallback>
                  {user.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-sm">{user.name}</span>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut}>
              <LogOut />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
