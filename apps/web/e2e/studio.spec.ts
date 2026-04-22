import { test, expect } from "@playwright/test";

// Smoke test — verifies the Studio UI renders without a live backend.
// Actual SSE generation calls are not exercised here; mocking streaming
// POST responses in Playwright is flaky and better covered by API tests.
test.describe("Studio smoke", () => {
  test("renders the prompt form on the root route", async ({ page }) => {
    await page.goto("/");
    // The prompt textarea is the entry point for every generation run.
    await expect(page.getByRole("textbox", { name: /prompt/i })).toBeVisible();
  });

  test("has a Generate button", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: /generate/i })
    ).toBeVisible();
  });
});
