import { describe, expect, it } from "vitest";

import { commandMap, commands } from "./index";

/** Discord's constraints on an application command's registered shape. */
const NAME = /^[-_'\p{L}\p{N}]{1,32}$/u;

describe("command registry", () => {
  it("registers every command in the lookup map", () => {
    expect(commandMap.size).toBe(commands.length);
  });

  it("has no duplicate command names", () => {
    // A duplicate would silently shadow one command at dispatch time.
    const names = commands.map((c) => c.data.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("resolves each command by name", () => {
    for (const command of commands) {
      expect(commandMap.get(command.data.name)).toBe(command);
    }
  });

  it.each(commands.map((c) => ({ name: c.data.name })))(
    "/$name has a Discord-valid name",
    ({ name }) => {
      expect(name).toMatch(NAME);
      expect(name).toBe(name.toLowerCase());
    },
  );

  it.each(commands.map((c) => ({ name: c.data.name, command: c })))(
    "/$name has a description within Discord's limit",
    ({ command }) => {
      const description = command.data.toJSON().description;
      expect(description.length).toBeGreaterThan(0);
      expect(description.length).toBeLessThanOrEqual(100);
    },
  );

  it.each(commands.map((c) => ({ name: c.data.name, command: c })))(
    "/$name serialises to a valid payload",
    ({ command }) => {
      // `toJSON` throws if the builder is missing anything Discord requires.
      expect(() => command.data.toJSON()).not.toThrow();
    },
  );

  it.each(commands.map((c) => ({ name: c.data.name, command: c })))(
    "/$name has an executable handler",
    ({ command }) => {
      expect(typeof command.execute).toBe("function");
    },
  );

  it("keeps every option name and description within Discord's limits", () => {
    for (const command of commands) {
      const walk = (options: { name: string; description: string; options?: unknown[] }[]) => {
        for (const option of options ?? []) {
          expect(option.name, `/${command.data.name} option`).toMatch(NAME);
          expect(option.description.length).toBeGreaterThan(0);
          expect(option.description.length).toBeLessThanOrEqual(100);
          walk((option.options ?? []) as typeof options);
        }
      };
      walk((command.data.toJSON().options ?? []) as never);
    }
  });

  it("stays within Discord's 25-option limit per command", () => {
    for (const command of commands) {
      expect((command.data.toJSON().options ?? []).length).toBeLessThanOrEqual(
        25,
      );
    }
  });

  it("includes the commands the ticket flow documents", () => {
    // A regression here means a documented command silently stopped shipping.
    for (const name of [
      "setup",
      "panel",
      "close",
      "closerequest",
      "claim",
      "unclaim",
      "add",
      "remove",
      "rename",
      "priority",
      "switchpanel",
      "notes",
      "cannedresponse",
      "oncall",
      "blacklist",
    ]) {
      expect(commandMap.has(name), `missing /${name}`).toBe(true);
    }
  });
});
