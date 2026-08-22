// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TICKET_PRIORITIES } from "@/lib/ticket-priority";
import { PriorityBadge } from "./priority-badge";

afterEach(cleanup);

describe("PriorityBadge", () => {
  it.each(TICKET_PRIORITIES.map((p) => ({ value: p.value, label: p.label })))(
    "labels $value as $label",
    ({ value, label }) => {
      render(<PriorityBadge priority={value} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    },
  );

  it("shows the priority's emoji alongside the label", () => {
    const { container } = render(<PriorityBadge priority="urgent" />);
    expect(container.textContent).toContain("🔴");
    expect(container.textContent).toContain("Urgent");
  });

  it("hides the emoji from assistive tech, which reads the label instead", () => {
    const { container } = render(<PriorityBadge priority="urgent" />);
    expect(container.querySelector("[aria-hidden]")).toHaveTextContent("🔴");
  });

  it("falls back to Normal for a missing priority", () => {
    render(<PriorityBadge priority={null} />);
    expect(screen.getByText("Normal")).toBeInTheDocument();
  });

  it("carries the priority's own styling", () => {
    const { container } = render(<PriorityBadge priority="urgent" />);
    expect(container.firstElementChild?.className).toContain("text-red-600");
  });

  it("merges an extra className", () => {
    const { container } = render(
      <PriorityBadge priority="low" className="self-start" />,
    );
    expect(container.firstElementChild).toHaveClass("self-start");
  });
});
