"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  deleteMultiPanel,
  resendMultiPanel,
} from "@/app/actions/multi-panel";
import { cn } from "@/lib/utils";

export function MultiPanelActions({ multiPanelId }: { multiPanelId: string }) {
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
        href={`/dashboard/panels/multi/${multiPanelId}`}
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
        aria-label="Edit multi-panel"
      >
        <Pencil />
      </Link>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={pending}
        onClick={() => run(() => resendMultiPanel(multiPanelId), "Multi-panel re-sent.")}
        aria-label="Resend multi-panel"
        title="Resend to Discord"
      >
        <Send />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={pending}
        onClick={() => run(() => deleteMultiPanel(multiPanelId), "Multi-panel deleted.")}
        aria-label="Delete multi-panel"
        title="Delete"
      >
        <Trash2 />
      </Button>
    </div>
  );
}
