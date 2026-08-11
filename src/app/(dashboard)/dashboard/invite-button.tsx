"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

/**
 * Opens the Discord invite in a popup and polls `/api/bot/status` until the bot
 * appears in a new server, then refreshes the page so the getting-started
 * checklist updates without a manual reload. Also refreshes when the user
 * closes the popup, in case detection lagged.
 */
export function InviteButton({
  inviteUrl,
  initialBotGuildCount,
}: {
  inviteUrl: string;
  initialBotGuildCount: number;
}) {
  const router = useRouter();
  const [waiting, setWaiting] = useState(false);
  const popupRef = useRef<Window | null>(null);

  const openPopup = useCallback(() => {
    const w = 500;
    const h = 800;
    const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
    popupRef.current = window.open(
      inviteUrl,
      "add-to-discord",
      `popup,width=${w},height=${h},left=${left},top=${top}`,
    );
    if (!popupRef.current) {
      // Popup blocked — fall back to a new tab and still poll.
      window.open(inviteUrl, "_blank", "noopener,noreferrer");
    }
    setWaiting(true);
  }, [inviteUrl]);

  useEffect(() => {
    if (!waiting) return;

    let done = false;
    const started = Date.now();

    const finish = (invited: boolean, refresh: boolean) => {
      if (done) return;
      done = true;
      clearInterval(id);
      popupRef.current?.close();
      setWaiting(false);
      if (invited) toast.success("Bot added — updating your checklist…");
      if (refresh) router.refresh();
    };

    const id = setInterval(async () => {
      // User closed the popup: refresh once so any change is reflected.
      if (popupRef.current?.closed) {
        finish(false, true);
        return;
      }
      if (Date.now() - started > POLL_TIMEOUT_MS) {
        finish(false, false);
        return;
      }
      try {
        const res = await fetch("/api/bot/status", { cache: "no-store" });
        if (!res.ok) return;
        const { botGuildCount } = (await res.json()) as {
          botGuildCount: number;
        };
        if (botGuildCount > initialBotGuildCount) {
          finish(true, true);
        }
      } catch {
        // transient — keep polling
      }
    }, POLL_INTERVAL_MS);

    return () => {
      done = true;
      clearInterval(id);
    };
  }, [waiting, initialBotGuildCount, router]);

  return (
    <Button size="sm" onClick={openPopup} disabled={waiting}>
      <Plus /> {waiting ? "Waiting…" : "Add to Discord"}
    </Button>
  );
}
