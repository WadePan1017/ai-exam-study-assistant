import path from "node:path";

import { expect, test } from "@playwright/test";

test("owner studies, records notes, imports JSON, and searches on a phone", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium");

  await page.goto("/");
  await page.getByLabel("访问口令").fill("phase-one-access");
  await page.getByRole("button", { name: "进入学习助手" }).click();

  await page.goto("/study");
  await expect(
    page.getByRole("heading", { name: "知识目录" }),
  ).toBeVisible();
  await expect(page.locator("details")).toHaveCount(18);

  await page.getByRole("link", { name: /项目的基本特征/ }).click();
  await expect(
    page.getByRole("heading", { name: "项目的基本特征" }),
  ).toBeVisible();

  await page.getByLabel("掌握状态").selectOption("learning");
  await page.getByLabel("个人笔记").fill("临时性描述项目边界。");
  await page.getByLabel("收藏这个知识点").check();
  await page.getByRole("button", { name: "保存学习记录" }).click();
  await expect(page.getByText("学习记录已保存")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("个人笔记")).toHaveValue(
    "临时性描述项目边界。",
  );
  await expect(page.getByLabel("掌握状态")).toHaveValue("learning");
  await expect(page.getByLabel("收藏这个知识点")).toBeChecked();

  await page.goto("/admin");
  const knowledgeImport = page.locator("section").filter({
    has: page.getByRole("heading", { name: "导入知识点 JSON" }),
  });
  await knowledgeImport
    .locator('input[type="file"]')
    .setInputFiles(
      path.resolve("tests/fixtures/knowledge-import-valid.json"),
    );
  await knowledgeImport
    .getByRole("button", { name: "校验并预览" })
    .click();
  await expect(
    page.getByText("校验通过，请确认预览后再导入"),
  ).toBeVisible();
  await expect(page.getByText("信息系统生命周期")).toBeVisible();

  await knowledgeImport
    .getByRole("button", { name: "确认事务导入" })
    .click();
  await expect(page.getByText("导入事务已完成")).toBeVisible();
  await expect(page.getByText(/新增 1，更新 0，跳过 0，失败 0/)).toBeVisible();

  await knowledgeImport
    .getByRole("button", { name: "校验并预览" })
    .click();
  await expect(page.getByText("版本相同，保持现有内容")).toBeVisible();

  await page.goto("/study?q=生命周期");
  await expect(
    page.getByRole("link", { name: /信息系统生命周期/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: /信息系统生命周期/ }).click();
  await expect(
    page.getByRole("heading", { name: "信息系统生命周期" }),
  ).toBeVisible();
});
