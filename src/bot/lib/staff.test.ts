import { describe, expect, it } from "vitest";
import { PermissionFlagsBits } from "discord.js";
import type { GuildMember } from "discord.js";

import type { Guild } from "@/db/schema";
import { isStaffMember } from "./staff";

/** Minimal stand-in for the two things `isStaffMember` actually reads. */
function member(opts: { manageChannels?: boolean; roles?: string[] }) {
  const roles = new Set(opts.roles ?? []);
  return {
    permissions: {
      has: (flag: bigint) =>
        flag === PermissionFlagsBits.ManageChannels &&
        Boolean(opts.manageChannels),
    },
    roles: { cache: { has: (id: string) => roles.has(id) } },
  } as unknown as GuildMember;
}

const config = (staffRoleIds: string[]) => ({ staffRoleIds }) as Guild;

describe("isStaffMember", () => {
  it("treats Manage Channels as staff even with no staff role", () => {
    expect(isStaffMember(member({ manageChannels: true }), config([]))).toBe(
      true,
    );
  });

  it("treats a configured staff role as staff", () => {
    expect(
      isStaffMember(member({ roles: ["r1"] }), config(["r1"])),
    ).toBe(true);
  });

  it("matches any one of several staff roles", () => {
    expect(
      isStaffMember(member({ roles: ["r3"] }), config(["r1", "r2", "r3"])),
    ).toBe(true);
  });

  it("rejects a member with neither", () => {
    expect(isStaffMember(member({ roles: ["other"] }), config(["r1"]))).toBe(
      false,
    );
  });

  it("rejects everyone when no staff roles are configured", () => {
    // Otherwise an unconfigured server would grant staff powers to all.
    expect(isStaffMember(member({ roles: ["r1"] }), config([]))).toBe(false);
  });

  it("rejects a member with no roles at all", () => {
    expect(isStaffMember(member({}), config(["r1"]))).toBe(false);
  });
});
