import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

import { MistakeBook } from "@/components/review/mistake-book";
import type { MistakeListItem } from "@/server/repositories/practice-store";

const dueMistake: MistakeListItem = {
  consecutiveCorrect: 0,
  dueStatus: "due_today",
  errorReason: null,
  externalId: "q-project-characteristics-001",
  isFavorite: true,
  isWrong: true,
  lastAttemptAt: "2026-07-18T01:00:00.000Z",
  lastWrongAt: "2026-07-18T01:00:00.000Z",
  masteredAt: null,
  moduleTitles: ["项目管理概论"],
  nextReviewAt: "2026-07-18T16:00:00.000Z",
  reviewLevel: 0,
  stem: "以下哪项最符合项目的基本特征？",
  totalAttempts: 1,
  version: 1,
  wrongAttempts: 1,
};

describe("错题本", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ session: { id: "review-session-1" } }),
        ok: true,
      }),
    );
  });

  it("展示到期状态并可以立即再练该题", async () => {
    const user = userEvent.setup();
    render(<MistakeBook initialMistakes={[dueMistake]} />);

    expect(
      screen.getByText("以下哪项最符合项目的基本特征？"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("今日到期")).not.toHaveLength(0);

    await user.click(
      screen.getByRole("button", { name: "再练此题" }),
    );

    expect(fetch).toHaveBeenCalledWith(
      "/api/practice/sessions",
      expect.objectContaining({
        body: JSON.stringify({
          count: 1,
          mode: "review",
          questionExternalId: "q-project-characteristics-001",
        }),
      }),
    );
    expect(push).toHaveBeenCalledWith(
      "/practice/review-session-1",
    );
  });

  it("可以保存错因并手动暂停自动复习", async () => {
    const user = userEvent.setup();
    render(<MistakeBook initialMistakes={[dueMistake]} />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: /错误原因/ }),
      "careless",
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/mistakes/q-project-characteristics-001/reason",
      expect.objectContaining({
        body: JSON.stringify({ reason: "careless" }),
        method: "PUT",
      }),
    );
    expect(screen.getByText("错因已保存")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "标记掌握" }),
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/mistakes/q-project-characteristics-001/mastered",
      { method: "POST" },
    );
    expect(
      screen.getByText("已标记掌握，自动复习已暂停"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("已暂停")).not.toHaveLength(0);
  });
});
