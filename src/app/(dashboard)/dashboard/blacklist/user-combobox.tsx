"use client";

import { useMemo, useState } from "react";

import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

export type PickableUser = { id: string; name: string };

const SNOWFLAKE = /^\d{17,20}$/;

/**
 * User picker for the blacklist: a searchable combobox of users who've opened
 * tickets in this server, with a fallback to paste any Discord user ID that
 * isn't in the list. The selected value is always a user ID string.
 */
export function UserCombobox({
  users,
  value,
  onValueChange,
  disabled,
}: {
  users: PickableUser[];
  value: string | null;
  onValueChange: (id: string | null) => void;
  disabled?: boolean;
}) {
  const [input, setInput] = useState("");

  const nameMap = useMemo(
    () => new Map(users.map((u) => [u.id, u.name])),
    [users],
  );

  // The item list is user IDs. When the typed text is a valid snowflake that
  // isn't already a known user, surface it as a "use this ID" entry. Keep the
  // current selection present so its label always resolves.
  const items = useMemo(() => {
    const ids = users.map((u) => u.id);
    const seen = new Set(ids);
    const typed = input.trim();
    const extras: string[] = [];
    if (SNOWFLAKE.test(typed) && !seen.has(typed)) extras.push(typed);
    if (value && !seen.has(value) && value !== typed) extras.push(value);
    return [...extras, ...ids];
  }, [users, input, value]);

  return (
    <Combobox
      items={items}
      value={value ?? null}
      onValueChange={(v) => onValueChange((v as string | null) ?? null)}
      onInputValueChange={setInput}
      itemToStringLabel={(id: string) => nameMap.get(id) ?? id}
      disabled={disabled}
    >
      <ComboboxInput
        placeholder="Search users or paste a user ID…"
        showClear
        className="w-full"
      />
      <ComboboxContent>
        <ComboboxEmpty>
          No matching users. Paste a Discord user ID to block someone who
          isn&apos;t listed.
        </ComboboxEmpty>
        <ComboboxList>
          <ComboboxCollection>
            {(id: string) => (
              <ComboboxItem key={id} value={id}>
                {nameMap.has(id) ? (
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{nameMap.get(id)}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {id}
                    </span>
                  </span>
                ) : (
                  <span>
                    Use ID <span className="font-mono">{id}</span>
                  </span>
                )}
              </ComboboxItem>
            )}
          </ComboboxCollection>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
