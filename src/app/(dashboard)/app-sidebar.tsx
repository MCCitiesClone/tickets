"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  PanelsTopLeft,
  Settings,
  Ticket,
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

type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
};

const navItems: NavItem[] = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { title: "Panels", href: "/dashboard/panels", icon: PanelsTopLeft, disabled: true },
  { title: "Tickets", href: "/dashboard/tickets", icon: Ticket, disabled: true },
  { title: "Settings", href: "/dashboard/settings", icon: Settings, disabled: true },
];

export function AppSidebar({
  user,
}: {
  user: { name: string; image?: string | null };
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
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Ticket className="size-5" />
          <span className="font-semibold">Tickets</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={pathname === item.href}
                  aria-disabled={item.disabled}
                  tooltip={item.disabled ? "Coming soon" : item.title}
                  render={
                    item.disabled ? (
                      <span className="pointer-events-none opacity-50" />
                    ) : (
                      <Link href={item.href} />
                    )
                  }
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
