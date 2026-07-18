import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CatalogTree } from "@/components/study/catalog-tree";
import type { StudyCatalog } from "@/server/repositories/learning-content-store";

const catalog: StudyCatalog = {
  matchedPublished: 1,
  modules: [
    {
      children: [
        {
          children: [],
          key: "module-09/项目与项目管理",
          knowledgePoints: [
            {
              difficulty: 1,
              externalId: "kp-project-characteristics",
              importance: "A",
              learningStatus: "learning",
              summary: "项目是为了创造独特成果而进行的临时性工作。",
              title: "项目的基本特征",
            },
          ],
          title: "项目与项目管理",
        },
      ],
      externalId: "module-09",
      key: "module-09",
      knowledgePoints: [],
      sortOrder: 9,
      title: "项目管理概论",
    },
  ],
  totalPublished: 1,
};

describe("CatalogTree", () => {
  it("shows nested published knowledge points and their learning state", () => {
    render(<CatalogTree catalog={catalog} />);

    expect(screen.getByText("项目管理概论")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /项目的基本特征/ }),
    ).toHaveAttribute("href", "/study/kp-project-characteristics");
    expect(screen.getByText("学习中")).toBeInTheDocument();
  });
});
