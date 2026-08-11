"use client";

import { Checkbox } from "@/components/ui/checkbox";

export type Role = { id: string; name: string };

/** A scrollable checkbox list for selecting multiple Discord roles. */
export function RoleMultiSelect({
  roles,
  value,
  onChange,
  emptyText = "No roles available.",
}: {
  roles: Role[];
  value: string[];
  onChange: (value: string[]) => void;
  emptyText?: string;
}) {
  if (roles.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  function toggle(id: string, checked: boolean) {
    onChange(checked ? [...value, id] : value.filter((r) => r !== id));
  }

  return (
    <div className="grid max-h-40 grid-cols-1 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2">
      {roles.map((role) => (
        <label key={role.id} className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={value.includes(role.id)}
            onCheckedChange={(c) => toggle(role.id, c === true)}
          />
          <span className="truncate">{role.name}</span>
        </label>
      ))}
    </div>
  );
}
