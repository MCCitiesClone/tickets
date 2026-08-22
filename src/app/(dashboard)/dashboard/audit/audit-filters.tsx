"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { EntityCombobox } from "@/components/entity-combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AUDIT_GROUPS } from "@/lib/audit";

const ANY = "__any";

const RANGES = [
  { value: ANY, label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

/**
 * Filter bar for the audit log. State lives in the URL so a filtered view is
 * shareable and survives a refresh, and so the page can stay a server component.
 */
export function AuditFilters({
  actors,
}: {
  actors: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const group = searchParams.get("group") ?? ANY;
  const actor = searchParams.get("actor");
  const range = searchParams.get("range") ?? ANY;
  const filtered = group !== ANY || actor || range !== ANY;

  function set(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams);
    if (!value || value === ANY) params.delete(key);
    else params.set(key, value);
    // Any filter change invalidates the current page number.
    params.delete("page");
    router.push(params.size ? `${pathname}?${params}` : pathname);
  }

  const groupItems = {
    [ANY]: "All activity",
    ...Object.fromEntries(AUDIT_GROUPS.map((g) => [g, g])),
  };
  const rangeItems = Object.fromEntries(RANGES.map((r) => [r.value, r.label]));

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-4 py-4">
        <div className="flex min-w-40 flex-col gap-1.5">
          <Label htmlFor="audit-group">Activity</Label>
          <Select
            items={groupItems}
            value={group}
            onValueChange={(v) => set("group", v as string)}
          >
            <SelectTrigger id="audit-group">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(groupItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-w-52 flex-col gap-1.5">
          <Label>Actor</Label>
          <EntityCombobox
            entities={actors}
            value={actor}
            onValueChange={(id) => set("actor", id)}
            placeholder={actors.length ? "Anyone" : "Nobody recorded yet"}
            emptyText="No matching people."
            disabled={actors.length === 0}
          />
        </div>

        <div className="flex min-w-40 flex-col gap-1.5">
          <Label htmlFor="audit-range">When</Label>
          <Select
            items={rangeItems}
            value={range}
            onValueChange={(v) => set("range", v as string)}
          >
            <SelectTrigger id="audit-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filtered && (
          <Button type="button" variant="ghost" onClick={() => router.push(pathname)}>
            <X className="size-4" />
            Clear
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
