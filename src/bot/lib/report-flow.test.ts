import { describe, expect, it } from "vitest";

import type { Panel } from "@/db/schema";
import {
  buildReportPanelSelect,
  reportablePanels,
  resolveReportPanel,
} from "./report-flow";
import type { ReportedMessage } from "./report-message";

const panel = (o: Partial<Panel> = {}): Panel =>
  ({
    id: "p1",
    title: "Support",
    buttonLabel: "Open Ticket",
    disabled: false,
    ...o,
  }) as Panel;

const report: ReportedMessage = {
  messageId: "111",
  channelId: "222",
  guildId: "333",
  authorId: "444",
  authorTag: "Offender",
  content: "rude",
  attachmentNames: [],
  embedCount: 0,
  createdAt: new Date(),
};

describe("reportablePanels", () => {
  it("excludes disabled panels", () => {
    // A panel an admin switched off shouldn't be reachable by another route.
    const panels = [panel({ id: "a" }), panel({ id: "b", disabled: true })];
    expect(reportablePanels(panels).map((p) => p.id)).toEqual(["a"]);
  });
});

describe("resolveReportPanel", () => {
  it("uses the configured panel", () => {
    const panels = [panel({ id: "a" }), panel({ id: "b" })];
    expect(resolveReportPanel(panels, "b")?.id).toBe("b");
  });

  it("prefers the configured panel even when several exist", () => {
    const panels = [panel({ id: "a" }), panel({ id: "b" }), panel({ id: "c" })];
    expect(resolveReportPanel(panels, "a")?.id).toBe("a");
  });

  it("falls back to the only panel, so a simple server needs no setup", () => {
    expect(resolveReportPanel([panel({ id: "a" })], null)?.id).toBe("a");
  });

  it("asks when there are several and none configured", () => {
    expect(
      resolveReportPanel([panel({ id: "a" }), panel({ id: "b" })], null),
    ).toBeNull();
  });

  it("ignores a configured panel that no longer exists", () => {
    // Deleted since it was configured — fall back rather than fail.
    expect(resolveReportPanel([panel({ id: "a" })], "gone")?.id).toBe("a");
  });

  it("ignores a configured panel that is disabled", () => {
    const panels = [panel({ id: "a" }), panel({ id: "b", disabled: true })];
    expect(resolveReportPanel(panels, "b")?.id).toBe("a");
  });

  it("returns null when every panel is disabled", () => {
    expect(
      resolveReportPanel([panel({ id: "a", disabled: true })], null),
    ).toBeNull();
  });

  it("returns null with no panels at all", () => {
    expect(resolveReportPanel([], null)).toBeNull();
  });
});

describe("buildReportPanelSelect", () => {
  const json = (panels: Panel[]) =>
    buildReportPanelSelect(panels, report).toJSON() as unknown as {
      components: {
        custom_id: string;
        options: { label: string; value: string; description?: string }[];
      }[];
    };

  it("carries the reported message in its custom id", () => {
    // The reference has to survive until the reporter picks.
    expect(json([panel()]).components[0].custom_id).toBe(
      "report_panel:222:111",
    );
  });

  it("offers one option per panel, valued by panel id", () => {
    const [select] = json([
      panel({ id: "a", title: "Support" }),
      panel({ id: "b", title: "Billing" }),
    ]).components;
    expect(select.options.map((o) => o.value)).toEqual(["a", "b"]);
  });

  it("labels an option with the button label, described by the title", () => {
    const [select] = json([
      panel({ title: "Support", buttonLabel: "Get help" }),
    ]).components;
    expect(select.options[0]).toMatchObject({
      label: "Get help",
      description: "Support",
    });
  });

  it("falls back to the title when a panel has no button label", () => {
    const [select] = json([panel({ title: "Support", buttonLabel: "" })])
      .components;
    expect(select.options[0].label).toBe("Support");
  });

  it("omits disabled panels", () => {
    const [select] = json([
      panel({ id: "a" }),
      panel({ id: "b", disabled: true }),
    ]).components;
    expect(select.options).toHaveLength(1);
  });

  it("caps at Discord's 25 options", () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      panel({ id: `p${i}`, title: `Panel ${i}` }),
    );
    expect(json(many).components[0].options).toHaveLength(25);
  });
});
