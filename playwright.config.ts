import { defineConfig, devices } from "@playwright/test";

const E2E_PORT = 3100;
const BASE_URL = `http://127.0.0.1:${E2E_PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run dev -- -H 127.0.0.1 -p ${E2E_PORT}`,
    env: {
      ADMIN_PATH: process.env.ADMIN_PATH ?? "/admin",
      AUTH_SECRET: process.env.AUTH_SECRET ?? "test-auth-secret-at-least-32-characters",
      DATABASE_URL: process.env.DATABASE_URL_TEST ?? "",
      NEXTAUTH_URL: BASE_URL,
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: BASE_URL,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
