// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Guild, Panel } from "@/db/schema";
import type { DiscordChannel } from "@/lib/discord-api";
import { CategoryCapacity } from "./category-capacity";

afterEach(cleanup);

const guild = (o: Partial<Guild> = {}): Guild =>
  ({
    ticketCategoryId: null,
    overflowCategoryIds: [],
    autoOverflowCategoryIds: [],
    autoCreateOverflow: true,
    ...o,
  }) as Guild;

const panel = (id: string, title: string, categoryId: string | null): Panel =>
  ({ id, title, categoryId }) as Panel;

const cat = (id: string, name: string, childCount: number): DiscordChannel => ({
  id,
  name,
  childCount,
});

/** Every rendered row, as "<name> <role> <count>/50 …". */
const rows = () =>
  screen.getAllByRole("progressbar").map((el) => el.parentElement!.textContent);

describe("CategoryCapacity", () => {
  it("prompts to configure a category when none is set", () => {
    render(<CategoryCapacity config={null} panels={[]} categories={[]} />);
    expect(
      screen.getByText(/No ticket category is configured yet/),
    ).toBeInTheDocument();
  });

  it("lists the server default, panel overrides and both overflow chains, in try order", () => {
    render(
      <CategoryCapacity
        config={guild({
          ticketCategoryId: "c1",
          overflowCategoryIds: ["c3"],
          autoOverflowCategoryIds: ["c4"],
        })}
        panels={[panel("p1", "Billing", "c2")]}
        categories={[
          cat("c1", "Tickets", 10),
          cat("c2", "Billing", 20),
          cat("c3", "Overflow", 30),
          cat("c4", "Auto", 40),
        ]}
      />,
    );

    const text = rows().join(" | ");
    expect(text).toContain("Server default");
    expect(text).toContain("Panel: Billing");
    expect(text).toContain("Overflow");
    expect(text).toContain("Auto-overflow");
    expect(rows()).toHaveLength(4);
    // Order matters: it mirrors the order `createTicketChannel` tries them.
    expect(rows()[0]).toContain("Tickets");
    expect(rows()[3]).toContain("Auto");
  });

  it("shows a category once, keeping the first role it takes", () => {
    // A panel that points at the server default shouldn't produce two bars.
    render(
      <CategoryCapacity
        config={guild({ ticketCategoryId: "c1", overflowCategoryIds: ["c1"] })}
        panels={[panel("p1", "Billing", "c1")]}
        categories={[cat("c1", "Tickets", 5)]}
      />,
    );
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toContain("Server default");
  });

  it("reports the used count and free slots", () => {
    render(
      <CategoryCapacity
        config={guild({ ticketCategoryId: "c1" })}
        panels={[]}
        categories={[cat("c1", "Tickets", 46)]}
      />,
    );
    expect(rows()[0]).toContain("46/50");
    expect(rows()[0]).toContain("4 free");
  });

  it("warns when a category is near the cap, naming it", () => {
    render(
      <CategoryCapacity
        config={guild({ ticketCategoryId: "c1", autoCreateOverflow: false })}
        panels={[]}
        categories={[cat("c1", "Tickets", 47)]}
      />,
    );
    expect(screen.getByText(/Tickets is nearly full/)).toBeInTheDocument();
    expect(screen.getByText(/Auto-overflow is off/)).toBeInTheDocument();
  });

  it("reassures when auto-overflow will cover it", () => {
    render(
      <CategoryCapacity
        config={guild({ ticketCategoryId: "c1", autoCreateOverflow: true })}
        panels={[]}
        categories={[cat("c1", "Tickets", 47)]}
      />,
    );
    expect(
      screen.getByText(/the bot will create another category as needed/),
    ).toBeInTheDocument();
  });

  it("pluralises the warning across several strained categories", () => {
    render(
      <CategoryCapacity
        config={guild({ ticketCategoryId: "c1", overflowCategoryIds: ["c2"] })}
        panels={[]}
        categories={[cat("c1", "A", 47), cat("c2", "B", 50)]}
      />,
    );
    expect(
      screen.getByText(/2 categories are nearly full/),
    ).toBeInTheDocument();
  });

  it("stays quiet when every category has room", () => {
    render(
      <CategoryCapacity
        config={guild({ ticketCategoryId: "c1" })}
        panels={[]}
        categories={[cat("c1", "Tickets", 10)]}
      />,
    );
    expect(screen.queryByText(/nearly full/)).not.toBeInTheDocument();
  });

  it("surfaces a configured category that no longer exists", () => {
    // Silently dropping it would hide a broken configuration.
    render(
      <CategoryCapacity
        config={guild({ ticketCategoryId: "gone" })}
        panels={[]}
        categories={[]}
      />,
    );
    expect(screen.getByText("Deleted category")).toBeInTheDocument();
    expect(rows()[0]).toContain("not found");
  });

  it("does not count a deleted category as strained", () => {
    render(
      <CategoryCapacity
        config={guild({ ticketCategoryId: "gone" })}
        panels={[]}
        categories={[]}
      />,
    );
    expect(screen.queryByText(/nearly full/)).not.toBeInTheDocument();
  });

  it("ignores panels with no category override", () => {
    render(
      <CategoryCapacity
        config={guild({ ticketCategoryId: "c1" })}
        panels={[panel("p1", "Billing", null)]}
        categories={[cat("c1", "Tickets", 1)]}
      />,
    );
    expect(rows()).toHaveLength(1);
  });

  it("states Discord's limit so the numbers are self-explanatory", () => {
    const { container } = render(
      <CategoryCapacity config={null} panels={[]} categories={[]} />,
    );
    expect(within(container).getByText(/50 channels per category/)).toBeInTheDocument();
  });
});
