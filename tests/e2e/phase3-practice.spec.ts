import path from "node:path";

import { expect, test } from "@playwright/test";

test("owner imports questions and completes a restorable phone practice session", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium");

  await page.goto("/");
  await page.getByLabel("访问口令").fill("phase-one-access");
  await page.getByRole("button", { name: "进入学习助手" }).click();

  await page.goto("/admin");
  const questionImport = page.locator("section").filter({
    has: page.getByRole("heading", { name: "导入题目 JSON" }),
  });
  await questionImport
    .locator('input[type="file"]')
    .setInputFiles(
      path.resolve("tests/fixtures/question-import-valid.json"),
    );
  await questionImport
    .getByRole("button", { name: "校验并预览题目" })
    .click();
  await expect(
    questionImport.getByText("题目校验通过，请确认预览后再导入"),
  ).toBeVisible();
  await expect(
    questionImport.getByText("q-project-goal-001", { exact: true }),
  ).toBeVisible();

  await questionImport
    .getByRole("button", { name: "确认导入题目" })
    .click();
  await expect(
    questionImport.getByText("题目导入事务已完成"),
  ).toBeVisible();
  await expect(
    questionImport.getByText(/新增 1，新版本 0，跳过 0，失败 0/),
  ).toBeVisible();

  await questionImport
    .getByRole("button", { name: "校验并预览题目" })
    .click();
  await expect(
    questionImport.getByText("版本相同，保持现有题目"),
  ).toBeVisible();

  await page.goto("/practice");
  await page.getByRole("button", { name: /章节练习/ }).click();
  await page.getByLabel("选择模块").selectOption("项目管理概论");
  await page.getByLabel("本次题量").fill("3");
  await page.getByRole("button", { name: "开始练习" }).click();

  await expect(
    page.getByRole("heading", {
      name: "以下哪项最符合项目的基本特征？",
    }),
  ).toBeVisible();
  await expect(page.getByText("正确答案：")).toHaveCount(0);
  await page
    .getByRole("radio", {
      name: "A.持续重复且没有明确结束边界",
    })
    .check();
  await page.getByLabel("这题我不确定").check();
  await page.getByRole("button", { name: "收藏本题" }).click();
  await page.getByRole("button", { name: "提交答案" }).click();

  await expect(page.getByRole("heading", { name: "回答错误" })).toBeVisible();
  await expect(page.getByText("正确答案：B")).toBeVisible();
  await expect(page.getByText("本次标记为不确定")).toBeVisible();

  await page.reload();
  await expect(page.getByText("正确答案：B")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "取消收藏本题" }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "下一题" }).click();
  await expect(
    page.getByRole("heading", {
      name: "项目经理平衡范围、进度、成本等相互影响的因素，最能说明什么？",
    }),
  ).toBeVisible();
  await page
    .getByRole("radio", {
      name: "A.项目制约因素之间存在关联",
    })
    .check();
  await page.getByRole("button", { name: "提交答案" }).click();
  await expect(page.getByRole("heading", { name: "回答正确" })).toBeVisible();

  await page.goto("/practice");
  await page.getByRole("button", { name: /只练未做题/ }).click();
  await expect(page.getByText("当前可用 1 题")).toBeVisible();
  await page.getByRole("button", { name: "开始练习" }).click();
  await expect(
    page.getByRole("heading", {
      name: "项目目标通常需要在哪些方面保持协调？",
    }),
  ).toBeVisible();
});
