import { expect, test } from "@playwright/test";

test("owner unlocks, refreshes, and locks the study space on a phone", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium");

  await page.goto("/");

  await expect(page).toHaveURL(/\/access/);
  await expect(
    page.getByRole("heading", { name: "开始今天的学习" }),
  ).toBeVisible();

  await page.getByLabel("访问口令").fill("incorrect-access");
  await page.getByRole("button", { name: "进入学习助手" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "访问口令不正确，请重新输入。",
  );

  await page.getByLabel("访问口令").fill("phase-one-access");
  await page.getByRole("button", { name: "进入学习助手" }).click();
  const sessionCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === "study_owner_session",
  );
  expect(sessionCookie?.httpOnly).toBe(true);
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", { name: "今天，从一个小目标开始" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "移动端主要导航" }),
  ).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL("/");

  await page.goto("/settings");
  await page.getByRole("button", { name: "锁定学习空间" }).click();
  await expect(page).toHaveURL(/\/access/);

  await page.goto("/");
  await expect(page).toHaveURL(/\/access/);
});

test("owner sees the desktop sidebar", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");

  await page.goto("/");
  await page.getByLabel("访问口令").fill("phase-one-access");
  await page.getByRole("button", { name: "进入学习助手" }).click();

  await expect(
    page.getByRole("navigation", {
      exact: true,
      name: "主要导航",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "移动端主要导航" }),
  ).toBeHidden();
});
