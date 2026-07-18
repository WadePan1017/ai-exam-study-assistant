import { expect, test } from "@playwright/test";

test("owner turns a wrong answer into a reviewed phone mistake", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium");

  await page.goto("/");
  await page.getByLabel("访问口令").fill("phase-one-access");
  await page.getByRole("button", { name: "进入学习助手" }).click();

  await page.goto("/practice");
  await page.getByLabel("本次题量").fill("1");
  await page.getByRole("button", { name: "开始练习" }).click();
  await page
    .getByRole("radio", {
      name: "A.持续重复且没有明确结束边界",
    })
    .check();
  const favoriteButton = page.getByRole("button", {
    name: /收藏本题/,
  });
  if ((await favoriteButton.getAttribute("aria-pressed")) !== "true") {
    await favoriteButton.click();
  }
  await page.getByRole("button", { name: "提交答案" }).click();
  await expect(
    page.getByRole("heading", { name: "回答错误" }),
  ).toBeVisible();

  await page.goto("/mistakes");
  const mistakeCard = page.locator("article").filter({
    has: page.getByRole("heading", {
      name: "以下哪项最符合项目的基本特征？",
    }),
  });
  await expect(mistakeCard).toBeVisible();
  await expect(mistakeCard.getByText("已收藏")).toBeVisible();
  await mistakeCard
    .getByRole("combobox", { name: /错误原因/ })
    .selectOption("concept_confusion");
  await expect(page.getByText("错因已保存")).toBeVisible();

  await mistakeCard
    .getByRole("button", { name: "再练此题" })
    .click();
  await expect(page).toHaveURL(/\/practice\/.+/);
  await page
    .getByRole("radio", {
      name: "B.为创造独特成果开展的临时性工作",
    })
    .check();
  await page.getByRole("button", { name: "提交答案" }).click();
  await expect(
    page.getByRole("heading", { name: "回答正确" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "取消收藏本题" }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.goto("/mistakes");
  const reviewedCard = page.locator("article").filter({
    has: page.getByRole("heading", {
      name: "以下哪项最符合项目的基本特征？",
    }),
  });
  await expect(reviewedCard.getByText("复习等级 2")).toBeVisible();
  await expect(reviewedCard.getByText("已收藏")).toBeVisible();
  await reviewedCard
    .getByRole("button", { name: "标记掌握" })
    .click();
  await expect(
    page.getByText("已标记掌握，自动复习已暂停"),
  ).toBeVisible();
  await expect(reviewedCard.getByText("已暂停")).toBeVisible();
  await expect(reviewedCard.getByText("已收藏")).toBeVisible();
});
