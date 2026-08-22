import type { TicketPriority } from "@/db/schema";
import { priorityMeta } from "@/lib/ticket-priority";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** A ticket's priority, rendered as a tinted badge with its emoji. */
export function PriorityBadge({
  priority,
  className,
}: {
  priority: TicketPriority | null | undefined;
  className?: string;
}) {
  const meta = priorityMeta(priority);
  return (
    <Badge variant="secondary" className={cn(meta.className, className)}>
      <span aria-hidden>{meta.emoji}</span>
      {meta.label}
    </Badge>
  );
}
