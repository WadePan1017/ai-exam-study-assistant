import { expect, test } from "@playwright/test";

test("owner completes a mobile mock exam and reviews the wrong answer", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium");

  await page.goto("/");
  await page.getByLabel("访问口令").fill("phase-one-access");
  await page.getByRole("button", { name: "进入学习助手" }).click();

  await page.goto("/mock-exam");
  await page
    .getByRole("button", { name: "开始模拟考试" })
    .click();
  await expect(page).toHaveURL(/\/mock-exam\/.+/);
  await expect(page.getByText(/已自动保存/)).toBeVisible();
  await expect(
    page.getByText("项目具有临时性和独特性。"),
  ).not.toBeVisible();

  await page
    .getByRole("button", {
      name: /A\s+持续重复且没有明确结束边界/,
    })
    .click();
  await page.getByRole("button", { name: /下一题/ }).click();
  await page
    .getByRole("button", {
      name: /A\s+项目制约因素之间存在关联/,
    })
    .click();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "交卷" }).last().click();

  await expect(
    page.getByRole("heading", { name: "章节拆解" }),
  ).toBeVisible();
  await expect(page.getByText("/ 2 分")).toBeVisible();
  await expect(
    page.getByText("项目具有临时性和独特性。"),
  ).toBeVisible();

  await page.getByRole("link", { name: "查看错题本" }).click();
  await expect(
    page.getByRole("heading", {
      name: "以下哪项最符合项目的基本特征？",
    }),
  ).toBeVisible();
});
