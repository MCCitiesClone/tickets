"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, RotateCw, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  deletePanel,
  resendPanel,
  resetPanelCooldowns,
} from "@/app/actions/panel";
import { cn } from "@/lib/utils";

export function PanelActions({ panelId }: { panelId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<unknown>, success: string) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(success);
        router.refresh();
      } catch {
        toast.error("That action failed. Check the bot's permissions.");
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Link
        href={`/dashboard/panels/${panelId}`}
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
        aria-label="Edit panel"
      >
        <Pencil />
      </Link>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={pending}
        onClick={() => run(() => resendPanel(panelId), "Panel re-sent.")}
        aria-label="Resend panel"
        title="Resend to Discord"
      >
        <Send />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={pending}
        onClick={() =>
          run(async () => {
            const n = await resetPanelCooldowns(panelId);
            return n;
          }, "Cooldowns reset.")
        }
        aria-label="Reset cooldowns"
        title="Reset cooldowns"
      >
        <RotateCw />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={pending}
        onClick={() => run(() => deletePanel(panelId), "Panel deleted.")}
        aria-label="Delete panel"
        title="Delete"
      >
        <Trash2 />
      </Button>
    </div>
  );
}
