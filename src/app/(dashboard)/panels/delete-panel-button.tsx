"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deletePanel } from "@/app/actions/panel";

export function DeletePanelButton({ panelId }: { panelId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      try {
        await deletePanel(panelId);
        toast.success("Panel deleted.");
        router.refresh();
      } catch {
        toast.error("Couldn't delete the panel.");
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      disabled={pending}
      aria-label="Delete panel"
    >
      <Trash2 />
    </Button>
  );
}
