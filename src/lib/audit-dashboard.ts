import type { AuditAction } from "@/lib/audit";
import { recordAuditEvent } from "@/lib/queries/audit";
import { getSessionActor } from "@/lib/session";

/**
 * Record a configuration change made through the dashboard.
 *
 * Server actions call this after a successful mutation. It resolves the actor
 * from the session itself rather than trusting a caller-supplied ID, and — like
 * every audit write — never throws, so a failed trail write can't roll back a
 * save that already succeeded.
 */
export async function recordDashboardAudit(
  guildId: string,
  action: AuditAction,
  summary: string,
  target?: { type?: string; id?: string; metadata?: Record<string, unknown> },
): Promise<void> {
  try {
    const actor = await getSessionActor();
    await recordAuditEvent({
      guildId,
      source: "dashboard",
      action,
      actorId: actor.id,
      actorName: actor.name,
      targetType: target?.type ?? null,
      targetId: target?.id ?? null,
      summary,
      metadata: target?.metadata ?? {},
    });
  } catch (err) {
    console.error("Failed to record dashboard audit event:", action, err);
  }
}
