// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EmojiAutocomplete } from "./emoji-autocomplete";

const GUILD_EMOJIS = [
  { id: "1", name: "smile_cat", animated: false },
  { id: "2", name: "smirk", animated: false },
];

/** A controlled field, so the tests exercise the same path the real editor uses. */
function Harness({ guildId }: { guildId?: string }) {
  const [value, setValue] = useState("");
  return (
    <EmojiAutocomplete guildId={guildId}>
      <textarea
        aria-label="content"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </EmojiAutocomplete>
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ emojis: GUILD_EMOJIS }),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const field = () => screen.getByLabelText("content") as HTMLTextAreaElement;
const menu = () => screen.queryByRole("listbox");

describe("EmojiAutocomplete", () => {
  it("opens the menu once a shortcode has two characters", async () => {
    const user = userEvent.setup();
    render(<Harness guildId="g1" />);
    await user.click(field());

    await user.keyboard(":s");
    expect(menu()).not.toBeInTheDocument();

    await user.keyboard("m");
    await waitFor(() => expect(menu()).toBeInTheDocument());
  });

  it("lists the server's custom emojis first", async () => {
    const user = userEvent.setup();
    render(<Harness guildId="g1" />);
    await user.click(field());
    await user.keyboard(":smi");

    await waitFor(() => expect(menu()).toBeInTheDocument());
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveTextContent(":smile_cat:");
    expect(options[1]).toHaveTextContent(":smirk:");
  });

  it("inserts the highlighted emoji on Enter, replacing the typed token", async () => {
    const user = userEvent.setup();
    render(<Harness guildId="g1" />);
    await user.click(field());
    await user.keyboard("hey :smi");
    await waitFor(() => expect(menu()).toBeInTheDocument());

    await user.keyboard("{Enter}");
    await waitFor(() => expect(field().value).toBe("hey <:smile_cat:1>"));
    expect(menu()).not.toBeInTheDocument();
  });

  it("inserts on Tab as well", async () => {
    const user = userEvent.setup();
    render(<Harness guildId="g1" />);
    await user.click(field());
    await user.keyboard(":smi");
    await waitFor(() => expect(menu()).toBeInTheDocument());

    await user.keyboard("{Tab}");
    await waitFor(() => expect(field().value).toBe("<:smile_cat:1>"));
  });

  it("moves the highlight with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Harness guildId="g1" />);
    await user.click(field());
    await user.keyboard(":smi");
    await waitFor(() => expect(menu()).toBeInTheDocument());

    await user.keyboard("{ArrowDown}");
    expect(screen.getAllByRole("option")[1]).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.keyboard("{Enter}");
    await waitFor(() => expect(field().value).toBe("<:smirk:2>"));
  });

  it("wraps the highlight around when arrowing up from the top", async () => {
    const user = userEvent.setup();
    render(<Harness guildId="g1" />);
    await user.click(field());
    await user.keyboard(":smi");
    await waitFor(() => expect(menu()).toBeInTheDocument());

    const count = screen.getAllByRole("option").length;
    await user.keyboard("{ArrowUp}");
    expect(screen.getAllByRole("option")[count - 1]).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("closes on Escape without changing the text", async () => {
    const user = userEvent.setup();
    render(<Harness guildId="g1" />);
    await user.click(field());
    await user.keyboard(":smi");
    await waitFor(() => expect(menu()).toBeInTheDocument());

    await user.keyboard("{Escape}");
    await waitFor(() => expect(menu()).not.toBeInTheDocument());
    expect(field().value).toBe(":smi");
  });

  it("inserts the clicked emoji", async () => {
    const user = userEvent.setup();
    render(<Harness guildId="g1" />);
    await user.click(field());
    await user.keyboard(":smi");
    await waitFor(() => expect(menu()).toBeInTheDocument());

    await user.click(screen.getAllByRole("option")[1]);
    await waitFor(() => expect(field().value).toBe("<:smirk:2>"));
  });

  it("closes again once the token stops matching", async () => {
    const user = userEvent.setup();
    render(<Harness guildId="g1" />);
    await user.click(field());
    await user.keyboard(":smi");
    await waitFor(() => expect(menu()).toBeInTheDocument());

    await user.keyboard(" ");
    await waitFor(() => expect(menu()).not.toBeInTheDocument());
  });

  it("stays shut for text that only looks like a shortcode", async () => {
    const user = userEvent.setup();
    render(<Harness guildId="g1" />);
    await user.click(field());

    await user.keyboard("meet at 12:30");
    expect(menu()).not.toBeInTheDocument();
  });

  it("stays shut when nothing matches the query", async () => {
    const user = userEvent.setup();
    render(<Harness guildId="g1" />);
    await user.click(field());

    await user.keyboard(":zzzqqq");
    expect(menu()).not.toBeInTheDocument();
  });

  it("leaves Enter alone when the menu is closed, so forms still submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <EmojiAutocomplete guildId="g1">
          <input aria-label="name" />
        </EmojiAutocomplete>
      </form>,
    );

    await user.click(screen.getByLabelText("name"));
    await user.keyboard("hello{Enter}");
    expect(onSubmit).toHaveBeenCalled();
  });

  it("offers unicode emoji with no guild configured, and fetches nothing", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(field());
    await user.keyboard(":rocket");

    await waitFor(() => expect(menu()).toBeInTheDocument());
    expect(screen.getAllByRole("option")[0]).toHaveTextContent(":rocket:");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("still offers unicode emoji when the emoji fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    const user = userEvent.setup();
    render(<Harness guildId="g1" />);
    await user.click(field());
    await user.keyboard(":rocket");

    await waitFor(() => expect(menu()).toBeInTheDocument());
    expect(screen.getAllByRole("option")[0]).toHaveTextContent(":rocket:");
  });
});
