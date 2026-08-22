import { beforeEach, describe, expect, it, vi } from "vitest";

// The cache is warmed from the database on ready; stub that one query so the
// rest of the module can be exercised without a connection.
const listOpenTicketChannels = vi.fn();
vi.mock("@/lib/queries/tickets", () => ({
  listOpenTicketChannels: () => listOpenTicketChannels(),
}));

const {
  getTrackedTicket,
  loadOpenTicketChannels,
  trackTicketChannel,
  untrackTicketChannel,
} = await import("./ticket-channels");

beforeEach(async () => {
  listOpenTicketChannels.mockResolvedValue([]);
  await loadOpenTicketChannels(); // reset between tests
  listOpenTicketChannels.mockReset();
});

describe("ticket channel cache", () => {
  it("returns undefined for a channel that isn't a ticket", () => {
    // messageCreate fires for every channel in every guild — this is the hot path.
    expect(getTrackedTicket("c-unknown")).toBeUndefined();
  });

  it("tracks and resolves a channel", () => {
    trackTicketChannel("c1", "t1");
    expect(getTrackedTicket("c1")).toBe("t1");
  });

  it("stops resolving once untracked", () => {
    trackTicketChannel("c1", "t1");
    untrackTicketChannel("c1");
    expect(getTrackedTicket("c1")).toBeUndefined();
  });

  it("ignores untracking a channel it never knew", () => {
    expect(() => untrackTicketChannel("nope")).not.toThrow();
  });

  it("re-tracking the same channel replaces the ticket id", () => {
    trackTicketChannel("c1", "t1");
    trackTicketChannel("c1", "t2");
    expect(getTrackedTicket("c1")).toBe("t2");
  });

  it("warms the cache from open tickets and reports the count", async () => {
    listOpenTicketChannels.mockResolvedValue([
      { id: "t1", channelId: "c1" },
      { id: "t2", channelId: "c2" },
    ]);
    expect(await loadOpenTicketChannels()).toBe(2);
    expect(getTrackedTicket("c1")).toBe("t1");
    expect(getTrackedTicket("c2")).toBe("t2");
  });

  it("clears stale entries when reloading", async () => {
    trackTicketChannel("stale", "t0");
    listOpenTicketChannels.mockResolvedValue([{ id: "t1", channelId: "c1" }]);
    await loadOpenTicketChannels();
    // A ticket closed while the bot was down must not stay tracked.
    expect(getTrackedTicket("stale")).toBeUndefined();
    expect(getTrackedTicket("c1")).toBe("t1");
  });
});
