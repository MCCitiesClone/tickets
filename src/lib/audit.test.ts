import { describe, expect, it } from "vitest";

import {
  AUDIT_ACTIONS,
  AUDIT_GROUPS,
  AUDIT_SOURCE_LABEL,
  actionsInGroup,
  auditActionMeta,
  type AuditAction,
} from "./audit";

const keys = Object.keys(AUDIT_ACTIONS) as AuditAction[];

describe("AUDIT_ACTIONS", () => {
  it("names every action `<area>.<verb>`", () => {
    for (const key of keys) {
      expect(key, key).toMatch(/^[a-z]+\.[a-z_]+$/);
    }
  });

  it("gives every action a label, group and emoji", () => {
    for (const key of keys) {
      const meta = AUDIT_ACTIONS[key];
      expect(meta.label.length, key).toBeGreaterThan(0);
      expect(meta.emoji.length, key).toBeGreaterThan(0);
      expect(AUDIT_GROUPS, key).toContain(meta.group);
    }
  });

  it("keeps labels distinct within a group, so the filter isn't ambiguous", () => {
    for (const group of AUDIT_GROUPS) {
      const labels = actionsInGroup(group).map((a) => AUDIT_ACTIONS[a].label);
      expect(new Set(labels).size, group).toBe(labels.length);
    }
  });
});

describe("actionsInGroup", () => {
  it.each(AUDIT_GROUPS)("returns only %s actions", (group) => {
    const actions = actionsInGroup(group);
    expect(actions.length).toBeGreaterThan(0);
    for (const a of actions) expect(AUDIT_ACTIONS[a].group).toBe(group);
  });

  it("partitions the registry — every action belongs to exactly one group", () => {
    const all = AUDIT_GROUPS.flatMap(actionsInGroup);
    expect(all.sort()).toEqual([...keys].sort());
  });
});

describe("auditActionMeta", () => {
  it.each(keys.map((action) => ({ action })))(
    "resolves $action",
    ({ action }) => {
      expect(auditActionMeta(action)).toEqual(AUDIT_ACTIONS[action]);
    },
  );

  it("degrades gracefully for an unknown action", () => {
    // A row written by a newer version must still render, not vanish.
    const meta = auditActionMeta("something.new");
    expect(meta.label).toBe("something.new");
    expect(meta.group).toBe("Other");
    expect(meta.emoji.length).toBeGreaterThan(0);
  });

  it("degrades for an empty action", () => {
    expect(auditActionMeta("").group).toBe("Other");
  });
});

describe("AUDIT_SOURCE_LABEL", () => {
  it("labels all three sources", () => {
    expect(Object.keys(AUDIT_SOURCE_LABEL).sort()).toEqual([
      "bot",
      "dashboard",
      "system",
    ]);
  });
});
