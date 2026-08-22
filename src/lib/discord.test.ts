import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { DISCORD_CLIENT_ID: "123456789" } }));

const { botInviteUrl } = await import("./discord");

describe("botInviteUrl", () => {
  const url = new URL(botInviteUrl());

  it("points at Discord's OAuth2 authorize endpoint", () => {
    expect(url.origin + url.pathname).toBe(
      "https://discord.com/oauth2/authorize",
    );
  });

  it("carries the application's client id", () => {
    expect(url.searchParams.get("client_id")).toBe("123456789");
  });

  it("requests both scopes the bot needs", () => {
    // Without applications.commands the slash commands never register.
    expect(url.searchParams.get("scope")).toBe("bot applications.commands");
  });

  // tsconfig targets ES2017, so build the flags rather than using BigInt literals.
  const bit = (n: number) => BigInt(1) << BigInt(n);
  const permissions = () => BigInt(url.searchParams.get("permissions")!);

  it("requests every permission the ticket flow depends on", () => {
    const required = {
      ViewChannel: bit(10),
      ManageChannels: bit(4),
      ManageRoles: bit(28),
      SendMessages: bit(11),
      EmbedLinks: bit(14),
      AttachFiles: bit(15),
      ReadMessageHistory: bit(16),
      ManageMessages: bit(13),
    };
    for (const [name, flag] of Object.entries(required)) {
      expect(permissions() & flag, `missing ${name}`).toBe(flag);
    }
  });

  it("does not request Administrator", () => {
    // Asking for Administrator would be a red flag on the invite screen.
    expect(permissions() & bit(3)).toBe(BigInt(0));
  });
});
