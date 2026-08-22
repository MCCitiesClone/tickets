// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MemberTicket } from "@/lib/queries/tickets";

const getSessionActor = vi.fn();
const listTicketsForMember = vi.fn();
const fetchBotGuilds = vi.fn();

vi.mock("@/lib/session", () => ({
  requireSession: async () => ({ user: { name: "Ada" } }),
  getSessionActor: () => getSessionActor(),
}));
vi.mock("@/lib/queries/tickets", () => ({
  listTicketsForMember: (id: string) => listTicketsForMember(id),
}));
vi.mock("@/lib/discord-api", () => ({
  fetchBotGuilds: () => fetchBotGuilds(),
}));

const { default: MyTicketsPage } = await import("./page");

/** Server components are async functions — await, then render the element. */
const renderPage = async () => render(await MyTicketsPage());

const ticket = (o: Partial<MemberTicket> = {}): MemberTicket => ({
  id: "t1",
  guildId: "g1",
  number: 42,
  status: "closed",
  panelTitle: "Billing",
  openedAt: new Date("2026-08-01T12:00:00Z"),
  closedAt: new Date("2026-08-02T12:00:00Z"),
  transcriptToken: "tok123",
  opened: true,
  ...o,
});

beforeEach(() => {
  getSessionActor.mockResolvedValue({ id: "u1", name: "Ada" });
  listTicketsForMember.mockResolvedValue([]);
  fetchBotGuilds.mockResolvedValue({ guilds: [{ id: "g1", name: "My Guild" }], ok: true });
});

afterEach(cleanup);

describe("My tickets", () => {
  it("asks an unlinked account to re-authenticate rather than querying", async () => {
    getSessionActor.mockResolvedValue({ id: null, name: "Ada" });
    await renderPage();

    expect(screen.getByText("Discord account not linked")).toBeInTheDocument();
    // Without an ID there is nothing safe to query — it must not guess.
    expect(listTicketsForMember).not.toHaveBeenCalled();
  });

  it("queries strictly by the signed-in user's Discord ID", async () => {
    await renderPage();
    expect(listTicketsForMember).toHaveBeenCalledWith("u1");
  });

  it("shows an empty state when the member has no tickets", async () => {
    await renderPage();
    expect(screen.getByText("No tickets yet")).toBeInTheDocument();
  });

  it("lists a ticket with its number, server and type", async () => {
    listTicketsForMember.mockResolvedValue([ticket()]);
    await renderPage();

    const row = screen.getByRole("row", { name: /42/ });
    expect(within(row).getByText("42")).toBeInTheDocument();
    expect(within(row).getByText("My Guild")).toBeInTheDocument();
    expect(within(row).getByText("Billing")).toBeInTheDocument();
  });

  it("links to the transcript when one exists", async () => {
    listTicketsForMember.mockResolvedValue([ticket()]);
    await renderPage();

    expect(screen.getByRole("link", { name: /view/i })).toHaveAttribute(
      "href",
      "/transcripts/tok123",
    );
  });

  it("shows a dash instead of a link when there's no transcript", async () => {
    listTicketsForMember.mockResolvedValue([
      ticket({ transcriptToken: null, status: "open" }),
    ]);
    await renderPage();

    expect(screen.queryByRole("link", { name: /view/i })).not.toBeInTheDocument();
  });

  it("marks a ticket the member only took part in", async () => {
    listTicketsForMember.mockResolvedValue([ticket({ opened: false })]);
    await renderPage();
    expect(screen.getByText("Took part")).toBeInTheDocument();
  });

  it("does not mark a ticket the member opened themselves", async () => {
    listTicketsForMember.mockResolvedValue([ticket({ opened: true })]);
    await renderPage();
    expect(screen.queryByText("Took part")).not.toBeInTheDocument();
  });

  it("falls back gracefully when the bot has left the server", async () => {
    // The ticket and its transcript outlive the bot's membership.
    listTicketsForMember.mockResolvedValue([ticket({ guildId: "gone" })]);
    await renderPage();

    expect(screen.getByText("Unknown server")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view/i })).toBeInTheDocument();
  });

  it("renders a ticket with no panel", async () => {
    listTicketsForMember.mockResolvedValue([ticket({ panelTitle: null })]);
    await renderPage();
    expect(screen.getByRole("row", { name: /42/ })).toHaveTextContent("—");
  });

  it("lists tickets from several servers together", async () => {
    fetchBotGuilds.mockResolvedValue({
      guilds: [
        { id: "g1", name: "My Guild" },
        { id: "g2", name: "Other Guild" },
      ],
      ok: true,
    });
    listTicketsForMember.mockResolvedValue([
      ticket({ id: "t1", number: 42, guildId: "g1" }),
      ticket({ id: "t2", number: 7, guildId: "g2" }),
    ]);
    await renderPage();

    expect(screen.getByText("My Guild")).toBeInTheDocument();
    expect(screen.getByText("Other Guild")).toBeInTheDocument();
  });
});
