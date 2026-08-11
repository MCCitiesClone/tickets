"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string };

/**
 * Thin wrapper around the shadcn (base-ui) Select for the common case of a
 * single-value dropdown over a flat option list. Full-width by default.
 */
export function SimpleSelect({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  className,
  id,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onValueChange((v as string) ?? "")}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={cn("w-full", className)}>
        {/*
          base-ui's SelectValue renders the raw value (e.g. the channel id) in
          the closed trigger unless it can map value -> label. The render
          function does that lookup from `options`, so the trigger shows the
          friendly label. Routing all selects through SimpleSelect keeps this
          correct everywhere.
        */}
        <SelectValue placeholder={placeholder}>
          {(v: unknown) =>
            options.find((o) => o.value === v)?.label ?? placeholder ?? null
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
