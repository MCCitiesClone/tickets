import { describe, expect, it } from "vitest";

import type { BoardTicket } from "@/lib/queries/tickets";
import {
  buildStatusBoard,
  groupTicketsByCategory,
  renderTicketRow,
} from "./status-board";

const NOW = new Date("2026-08-24T12:00:00Z");
const OPENED = new Date("2026-08-24T09:00:00Z");
const OPENED_UNIX = Math.floor(OPENED.getTime() / 1000);

const ticket = (o: Partial<BoardTicket> = {}): BoardTicket => ({
  id: "t1",
  number: 42,
  channelId: "c1",
  openerId: "u1",
  claimedBy: null,
  priority: "normal",
  waitingOn: "staff",
  openedAt: OPENED,
  ...o,
});

const categories: Record<string, { id: string; name: string }> = {
  c1: { id: "cat1", name: "Support" },
  c2: { id: "cat1", name: "Support" },
  c3: { id: "cat2", name: "Billing" },
};
const categoryOf = (channelId: string) => categories[channelId] ?? null;

describe("groupTicketsByCategory", () => {
  it("groups tickets by the category their channel sits in", () => {
    const groups = groupTicketsByCategory(
      [ticket({ channelId: "c1" }), ticket({ channelId: "c3" })],
      categoryOf,
    );
    expect(groups.map((g) => g.name).sort()).toEqual(["Billing", "Support"]);
  });

  it("puts the busiest category first", () => {
    // That's where attention is needed.
    const groups = groupTicketsByCategory(
      [
        ticket({ id: "a", channelId: "c3" }),
        ticket({ id: "b", channelId: "c1" }),
        ticket({ id: "c", channelId: "c2" }),
      ],
      categoryOf,
    );
    expect(groups[0].name).toBe("Support");
    expect(groups[0].tickets).toHaveLength(2);
  });

  it("breaks a tie alphabetically, so the order is stable between refreshes", () => {
    const groups = groupTicketsByCategory(
      [ticket({ id: "a", channelId: "c3" }), ticket({ id: "b", channelId: "c1" })],
      categoryOf,
    );
    expect(groups.map((g) => g.name)).toEqual(["Billing", "Support"]);
  });

  it("collects channels with no parent under one heading", () => {
    const groups = groupTicketsByCategory(
      [ticket({ channelId: "orphan" })],
      categoryOf,
    );
    expect(groups[0]).toMatchObject({ categoryId: null, name: "Uncategorised" });
  });

  it("returns nothing for no tickets", () => {
    expect(groupTicketsByCategory([], categoryOf)).toEqual([]);
  });
});

describe("renderTicketRow", () => {
  it("links the channel and names the opener", () => {
    const row = renderTicketRow(ticket());
    expect(row).toContain("<#c1>");
    expect(row).toContain("<@u1>");
  });

  it("shows the open time as a relative timestamp", () => {
    // Relative renders in each reader's own timezone.
    expect(renderTicketRow(ticket())).toContain(`<t:${OPENED_UNIX}:R>`);
  });

  it("marks an unclaimed ticket", () => {
    expect(renderTicketRow(ticket())).toContain("unclaimed");
  });

  it("names the claimer when there is one", () => {
    const row = renderTicketRow(ticket({ claimedBy: "s1" }));
    expect(row).toContain("<@s1>");
    expect(row).not.toContain("unclaimed");
  });

  it.each([
    { waitingOn: "staff" as const, text: "Waiting on staff" },
    { waitingOn: "user" as const, text: "Waiting on user" },
  ])("shows $text", ({ waitingOn, text }) => {
    expect(renderTicketRow(ticket({ waitingOn }))).toContain(text);
  });

  it("carries the priority's emoji", () => {
    expect(renderTicketRow(ticket({ priority: "urgent" }))).toContain("🔴");
  });
});

describe("buildStatusBoard", () => {
  const groupsOf = (tickets: BoardTicket[]) =>
    groupTicketsByCategory(tickets, categoryOf);

  it("says so when nothing is open", () => {
    const [embed] = buildStatusBoard([], NOW);
    expect(embed.data.description).toContain("No tickets are open");
  });

  it("stamps the empty board with an update time", () => {
    // Otherwise a stale board is indistinguishable from a quiet one.
    const [embed] = buildStatusBoard([], NOW);
    expect(embed.data.description).toContain(
      `<t:${Math.floor(NOW.getTime() / 1000)}:R>`,
    );
  });

  it("renders one embed per category, titled with its count", () => {
    const embeds = buildStatusBoard(
      groupsOf([
        ticket({ id: "a", channelId: "c1" }),
        ticket({ id: "b", channelId: "c2" }),
        ticket({ id: "c", channelId: "c3" }),
      ]),
      NOW,
    );
    expect(embeds).toHaveLength(2);
    expect(embeds[0].data.title).toBe("🎫 Support — 2");
    expect(embeds[1].data.title).toBe("🎫 Billing — 1");
  });

  it("puts the total and update time in the last embed only", () => {
    const embeds = buildStatusBoard(
      groupsOf([
        ticket({ id: "a", channelId: "c1" }),
        ticket({ id: "b", channelId: "c3" }),
      ]),
      NOW,
    );
    expect(embeds[0].data.description).not.toContain("open ·");
    expect(embeds[1].data.description).toContain("2 open ·");
  });

  it("summarises the remainder rather than silently truncating a group", () => {
    // "and 5 more" tells an operator to look; a short list reads as the whole
    // queue.
    const many = Array.from({ length: 25 }, (_, i) =>
      ticket({ id: `t${i}`, number: i, channelId: "c1" }),
    );
    const [embed] = buildStatusBoard(groupsOf(many), NOW);
    expect(embed.data.description).toContain("…and 5 more");
  });

  it("keeps every embed within Discord's description limit", () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      ticket({ id: `t${i}`, number: i, channelId: "c1", claimedBy: "s1" }),
    );
    for (const embed of buildStatusBoard(groupsOf(many), NOW)) {
      expect(embed.data.description!.length).toBeLessThanOrEqual(4096);
    }
  });

  it("stays within Discord's 10-embed and 6000-character message limits", () => {
    // 14 categories, each busy.
    const lots = Array.from({ length: 14 }, (_, c) =>
      Array.from({ length: 20 }, (_, i) =>
        ticket({ id: `c${c}t${i}`, channelId: `chan${c}`, claimedBy: "s1" }),
      ),
    ).flat();
    const embeds = buildStatusBoard(
      groupTicketsByCategory(lots, (id) => ({ id, name: `Category ${id}` })),
      NOW,
    );

    expect(embeds.length).toBeLessThanOrEqual(10);
    const total = embeds.reduce(
      (n, e) => n + (e.data.description?.length ?? 0),
      0,
    );
    expect(total).toBeLessThanOrEqual(6000);
  });

  it("notes categories it had to leave out", () => {
    const lots = Array.from({ length: 14 }, (_, c) =>
      ticket({ id: `t${c}`, channelId: `chan${c}` }),
    );
    const embeds = buildStatusBoard(
      groupTicketsByCategory(lots, (id) => ({ id, name: `Category ${id}` })),
      NOW,
    );
    const last = embeds[embeds.length - 1].data.description!;
    expect(last).toContain("more categories");
  });

  it("counts every open ticket in the total, including ones not shown", () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      ticket({ id: `t${i}`, channelId: "c1" }),
    );
    const embeds = buildStatusBoard(groupsOf(many), NOW);
    expect(embeds[embeds.length - 1].data.description).toContain("25 open");
  });
});
