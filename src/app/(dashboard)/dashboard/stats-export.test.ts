import { describe, expect, it } from "vitest";

import { csvCell, toCsv } from "./stats-export";

describe("csvCell", () => {
  it.each([
    { value: "plain", expected: "plain" },
    { value: 42, expected: "42" },
    { value: 0, expected: "0" },
    { value: null, expected: "" },
  ])("passes $value through as $expected", ({ value, expected }) => {
    expect(csvCell(value)).toBe(expected);
  });

  it("quotes a value containing a comma", () => {
    // A staff display name with a comma would otherwise split into two columns.
    expect(csvCell("Doe, Jane")).toBe('"Doe, Jane"');
  });

  it("quotes and doubles embedded quotes", () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it("quotes a value containing a newline", () => {
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("leaves a lone quote-free string unquoted", () => {
    expect(csvCell("no-special-chars")).toBe("no-special-chars");
  });
});

describe("toCsv", () => {
  it("joins cells with commas and rows with CRLF", () => {
    expect(
      toCsv([
        ["date", "opened"],
        ["2026-08-22", 3],
      ]),
    ).toBe("date,opened\r\n2026-08-22,3");
  });

  it("escapes per cell, not per row", () => {
    expect(toCsv([["a,b", "c"]])).toBe('"a,b",c');
  });

  it("renders an empty row set as an empty string", () => {
    expect(toCsv([])).toBe("");
  });

  it("keeps empty cells as empty fields, preserving column count", () => {
    expect(toCsv([[null, "x", null]])).toBe(",x,");
  });

  it("round-trips a realistic staff row", () => {
    expect(
      toCsv([
        ["staff", "user_id", "closed", "claimed", "avg_resolution"],
        ['Ada "Ace" L, jr', "1", 5, 3, "2h 15m"],
      ]),
    ).toBe(
      'staff,user_id,closed,claimed,avg_resolution\r\n"Ada ""Ace"" L, jr",1,5,3,2h 15m',
    );
  });
});
