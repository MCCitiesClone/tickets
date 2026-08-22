// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { insertAtCaret, replaceRange } from "./editor-utils";

afterEach(cleanup);

/** Controlled field, matching how the editor's own inputs are wired. */
function Field({ initial = "", textarea = false }) {
  const [value, setValue] = useState(initial);
  const props = {
    "aria-label": "field",
    value,
    onChange: (e: { target: { value: string } }) => setValue(e.target.value),
  };
  return textarea ? <textarea {...props} /> : <input {...props} />;
}

const el = () =>
  screen.getByLabelText("field") as HTMLInputElement | HTMLTextAreaElement;

describe("insertAtCaret", () => {
  it("inserts at the caret and updates the controlled value", async () => {
    render(<Field initial="ab" />);
    const field = el();
    field.setSelectionRange(1, 1);

    insertAtCaret(field, "X");
    // Going through the native setter is what makes React's onChange fire.
    await waitFor(() => expect(field.value).toBe("aXb"));
  });

  it("replaces the current selection", async () => {
    render(<Field initial="hello world" />);
    const field = el();
    field.setSelectionRange(0, 5);

    insertAtCaret(field, "bye");
    await waitFor(() => expect(field.value).toBe("bye world"));
  });

  it("appends when the field is empty", async () => {
    render(<Field />);
    insertAtCaret(el(), "{user}");
    await waitFor(() => expect(el().value).toBe("{user}"));
  });

  it("works on a textarea as well as an input", async () => {
    render(<Field initial="ab" textarea />);
    const field = el();
    field.setSelectionRange(2, 2);

    insertAtCaret(field, "!");
    await waitFor(() => expect(field.value).toBe("ab!"));
  });

  it("leaves the caret after the inserted text", async () => {
    render(<Field initial="ab" />);
    const field = el();
    field.setSelectionRange(1, 1);

    insertAtCaret(field, "XYZ");
    await waitFor(() => expect(field.selectionStart).toBe(4));
  });
});

describe("replaceRange", () => {
  it("swaps an arbitrary range", async () => {
    render(<Field initial="hey :smi" />);
    const field = el();

    replaceRange(field, 4, 8, "<:smirk:2>");
    await waitFor(() => expect(field.value).toBe("hey <:smirk:2>"));
  });

  it("can replace the whole value", async () => {
    render(<Field initial="old" />);
    const field = el();

    replaceRange(field, 0, 3, "new");
    await waitFor(() => expect(field.value).toBe("new"));
  });

  it("inserts when start and end are equal", async () => {
    render(<Field initial="ac" />);
    const field = el();

    replaceRange(field, 1, 1, "b");
    await waitFor(() => expect(field.value).toBe("abc"));
  });

  it("can delete a range", async () => {
    render(<Field initial="abcdef" />);
    const field = el();

    replaceRange(field, 1, 4, "");
    await waitFor(() => expect(field.value).toBe("aef"));
  });

  it("leaves the caret just after the replacement", async () => {
    render(<Field initial="hey :smi" />);
    const field = el();

    replaceRange(field, 4, 8, "<:smirk:2>");
    await waitFor(() => expect(field.selectionStart).toBe(14));
  });
});
