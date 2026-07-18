import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

import { AppNavigation } from "@/components/layout/app-navigation";

describe("application navigation", () => {
  it("exposes the primary study destinations", () => {
    render(<AppNavigation />);

    for (const label of [
      "首页",
      "学习",
      "刷题",
      "模考",
      "错题",
      "我的",
    ]) {
      expect(screen.getAllByRole("link", { name: label })).not.toHaveLength(0);
    }
  });
});
