import { defineConfig, devices } from "@playwright/test";

const testSessionSecret =
  "phase-1-e2e-session-secret-with-at-least-32-characters";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        channel: "chrome",
      },
    },
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
      },
    },
  ],
  webServer: {
    command: "pnpm dev",
    env: {
      APP_ACCESS_KEY: "phase-one-access",
      APP_SESSION_SECRET: testSessionSecret,
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: "http://localhost:3000/access",
  },
});
