"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

export type ComboEntity = {
  id: string;
  name: string;
  avatarUrl?: string | null;
};

const SNOWFLAKE = /^\d{17,20}$/;

/**
 * A searchable combobox over `{ id, name, avatarUrl? }` entities (roles, users,
 * …). With `allowPasteId`, a pasted Discord snowflake that isn't in the list
 * becomes a selectable option; if `resolveId` is provided, the pasted ID is
 * resolved (e.g. via Discord) to show the real name + avatar. The selected value
 * is always the entity's ID string.
 */
export function EntityCombobox({
  entities,
  value,
  onValueChange,
  placeholder,
  emptyText,
  allowPasteId = false,
  resolveId,
  disabled,
}: {
  entities: ComboEntity[];
  value: string | null;
  onValueChange: (id: string | null) => void;
  placeholder?: string;
  emptyText?: string;
  allowPasteId?: boolean;
  resolveId?: (id: string) => Promise<ComboEntity | null>;
  disabled?: boolean;
}) {
  const [input, setInput] = useState("");
  // Resolutions of pasted IDs not in `entities`: entity, null (miss), or
  // "pending" while the lookup is in flight.
  const [resolved, setResolved] = useState<
    Map<string, ComboEntity | null | "pending">
  >(new Map());

  const entityMap = useMemo(
    () => new Map(entities.map((e) => [e.id, e])),
    [entities],
  );

  const typed = input.trim();
  const pastable =
    allowPasteId && SNOWFLAKE.test(typed) && !entityMap.has(typed);

  // Resolve a freshly pasted ID (debounced), once, caching the result.
  useEffect(() => {
    if (!pastable || !resolveId || resolved.has(typed)) return;
    const id = typed;
    const timer = setTimeout(() => {
      setResolved((m) => new Map(m).set(id, "pending"));
      resolveId(id)
        .then((r) => setResolved((m) => new Map(m).set(id, r)))
        .catch(() => setResolved((m) => new Map(m).set(id, null)));
    }, 300);
    return () => clearTimeout(timer);
  }, [pastable, typed, resolveId, resolved]);

  // Item list is entity IDs; keep the pasted candidate and current value present.
  const items = useMemo(() => {
    const ids = entities.map((e) => e.id);
    const seen = new Set(ids);
    const extra: string[] = [];
    if (pastable) extra.push(typed);
    if (value && !seen.has(value) && value !== typed) extra.push(value);
    return [...extra, ...ids];
  }, [entities, pastable, typed, value]);

  // Keep the id (not the resolved name) as the filter/label for pasted entries so
  // they stay matchable while the input holds the id; the row content shows the
  // resolved name + avatar.
  const label = (id: string) => entityMap.get(id)?.name ?? id;

  function renderRow(id: string) {
    const known = entityMap.get(id);
    if (known) return <EntityRow entity={known} />;

    const r = resolved.get(id);
    if (r && r !== "pending") return <EntityRow entity={r} subtle={id} />;
    return (
      <span className="text-muted-foreground">
        {r === "pending" ? "Resolving…" : "Use ID"}{" "}
        <span className="font-mono">{id}</span>
      </span>
    );
  }

  return (
    <Combobox
      items={items}
      value={value ?? null}
      onValueChange={(v) => onValueChange((v as string | null) ?? null)}
      onInputValueChange={setInput}
      itemToStringLabel={label}
      disabled={disabled}
    >
      <ComboboxInput placeholder={placeholder} showClear className="w-full" />
      <ComboboxContent>
        {emptyText && <ComboboxEmpty>{emptyText}</ComboboxEmpty>}
        <ComboboxList>
          <ComboboxCollection>
            {(id: string) => (
              <ComboboxItem key={id} value={id}>
                {renderRow(id)}
              </ComboboxItem>
            )}
          </ComboboxCollection>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function EntityRow({
  entity,
  subtle,
}: {
  entity: ComboEntity;
  subtle?: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {entity.avatarUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entity.avatarUrl}
          alt=""
          className="size-5 shrink-0 rounded-full"
        />
      )}
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{entity.name}</span>
        {subtle && (
          <span className="font-mono text-xs text-muted-foreground">
            {subtle}
          </span>
        )}
      </span>
    </span>
  );
}
