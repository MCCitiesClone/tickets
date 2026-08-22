import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Guild } from "@/db/schema";

const listActiveOnCall = vi.fn();
vi.mock("@/lib/queries/on-call", () => ({
  listActiveOnCall: (guildId: string) => listActiveOnCall(guildId),
}));

const { notifyOnCallStaff } = await import("./on-call");

/** Fake guild whose `users.fetch` yields a user with a spy-able `send`. */
function guild(sendImpl: (id: string) => Promise<unknown> = async () => {}) {
  const sends: { id: string; payload: unknown }[] = [];
  return {
    sends,
    guild: {
      id: "g1",
      name: "My Guild",
      client: {
        users: {
          fetch: async (id: string) => ({
            send: async (payload: unknown) => {
              sends.push({ id, payload });
              return sendImpl(id);
            },
          }),
        },
      },
    },
  };
}

const config = (o: Partial<Guild> = {}) =>
  ({ onCallPingOnOpen: true, ...o }) as Guild;

const ticket = {
  number: 42,
  channelId: "c1",
  openerId: "u9",
  panelTitle: "Billing",
};

beforeEach(() => {
  listActiveOnCall.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("notifyOnCallStaff", () => {
  it("DMs everyone currently on call", async () => {
    listActiveOnCall.mockResolvedValue([{ userId: "s1" }, { userId: "s2" }]);
    const g = guild();

    const result = await notifyOnCallStaff(g.guild as never, config(), ticket);

    expect(result.notified.sort()).toEqual(["s1", "s2"]);
    expect(result.failed).toEqual([]);
    expect(g.sends).toHaveLength(2);
  });

  it("does nothing when the guild has notifications switched off", async () => {
    const g = guild();
    const result = await notifyOnCallStaff(
      g.guild as never,
      config({ onCallPingOnOpen: false }),
      ticket,
    );

    expect(result).toEqual({ notified: [], failed: [] });
    // It must not even query the roster.
    expect(listActiveOnCall).not.toHaveBeenCalled();
  });

  it("does nothing when nobody is on call", async () => {
    listActiveOnCall.mockResolvedValue([]);
    const g = guild();

    expect(
      await notifyOnCallStaff(g.guild as never, config(), ticket),
    ).toEqual({ notified: [], failed: [] });
    expect(g.sends).toHaveLength(0);
  });

  it("records who it couldn't reach instead of throwing", async () => {
    // A member with DMs closed must never break the ticket open.
    listActiveOnCall.mockResolvedValue([{ userId: "s1" }, { userId: "s2" }]);
    const g = guild(async (id) => {
      if (id === "s2") throw new Error("Cannot send messages to this user");
    });

    const result = await notifyOnCallStaff(g.guild as never, config(), ticket);
    expect(result.notified).toEqual(["s1"]);
    expect(result.failed).toEqual(["s2"]);
  });

  it("survives the roster query failing", async () => {
    listActiveOnCall.mockRejectedValue(new Error("db down"));
    const g = guild();

    expect(
      await notifyOnCallStaff(g.guild as never, config(), ticket),
    ).toEqual({ notified: [], failed: [] });
  });

  it("names the ticket, opener and panel in the DM", async () => {
    listActiveOnCall.mockResolvedValue([{ userId: "s1" }]);
    const g = guild();

    await notifyOnCallStaff(g.guild as never, config(), ticket);
    const payload = g.sends[0].payload as {
      embeds: { data: { title?: string; description?: string } }[];
    };
    expect(payload.embeds[0].data.title).toContain("#42");
    expect(payload.embeds[0].data.title).toContain("My Guild");
    expect(payload.embeds[0].data.description).toContain("<@u9>");
    expect(payload.embeds[0].data.description).toContain("Billing");
  });

  it("omits the panel when the ticket has none", async () => {
    listActiveOnCall.mockResolvedValue([{ userId: "s1" }]);
    const g = guild();

    await notifyOnCallStaff(g.guild as never, config(), {
      ...ticket,
      panelTitle: null,
    });
    const payload = g.sends[0].payload as {
      embeds: { data: { description?: string } }[];
    };
    expect(payload.embeds[0].data.description).toContain("<@u9>");
    expect(payload.embeds[0].data.description).not.toContain("from **");
  });

  it("includes a link button straight to the ticket channel", async () => {
    listActiveOnCall.mockResolvedValue([{ userId: "s1" }]);
    const g = guild();

    await notifyOnCallStaff(g.guild as never, config(), ticket);
    const payload = g.sends[0].payload as {
      components: { toJSON(): { components: { url?: string }[] } }[];
    };
    expect(payload.components[0].toJSON().components[0].url).toBe(
      "https://discord.com/channels/g1/c1",
    );
  });

  it("scopes the roster query to this guild", async () => {
    listActiveOnCall.mockResolvedValue([]);
    await notifyOnCallStaff(guild().guild as never, config(), ticket);
    expect(listActiveOnCall).toHaveBeenCalledWith("g1");
  });
});
