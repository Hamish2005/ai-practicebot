import { test, expect } from "@playwright/test";
import { demoMessages } from "../../src/providers/fake";

test("learner completes a conversation, reviews evidence, and restarts", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Handling a Duplicate Charge" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start conversation" }).click();
  await expect(page.getByRole("log")).toContainText("I was charged twice");
  await page.screenshot({
    path: "test-results/desktop-session.png",
    fullPage: true,
  });
  for (const message of demoMessages) {
    await page
      .getByRole("textbox", { name: "Your response to Practice Bot" })
      .fill(message);
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Reviewing" }),
    ).toHaveCount(0);
  }
  await expect(
    page.getByRole("heading", { name: "A conversation well handled." }),
  ).toBeVisible();
  await expect(
    page.getByText("Successful · All required objectives demonstrated"),
  ).toBeVisible();
  await expect(page.locator("blockquote")).toHaveCount(5);
  await expect(
    page.getByLabel("Overall score: 100 out of 100", { exact: true }),
  ).toBeVisible();
  await page.getByText("View full transcript").click();
  await expect(page.locator(".transcript-details .message")).toHaveCount(6);
  await page.getByRole("button", { name: "Restart Scenario" }).click();
  await expect(page.getByRole("textbox")).toBeEnabled();
  await expect(page.getByRole("log").locator(".message")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("ending early shows all category scores and keeps them after refresh", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start conversation" }).click();
  await page
    .getByRole("textbox")
    .fill("That is frustrating, I can give you your money back");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("textbox")).toBeEnabled();
  await page.getByRole("button", { name: "End Session" }).click();
  await expect(
    page.getByLabel("Overall score: 40 out of 100", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".category-scores li")).toHaveCount(5);
  await expect(
    page.locator(".category-scores li").filter({ hasText: "Show empathy" }),
  ).toContainText("100 / 100");
  await expect(
    page
      .locator(".category-scores li")
      .filter({ hasText: "Explain what happens next" }),
  ).toContainText("0 / 100");
  await page.reload();
  await expect(
    page.getByLabel("Overall score: 40 out of 100", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/early-end-scores.png",
    fullPage: true,
  });
});

test("mobile layout, failed-request retry, and off-topic ending", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Start conversation" }).click();
  await expect(page.getByRole("textbox")).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  let failOnce = true;
  await page.route("**/api/session", async (route) => {
    if (route.request().method() === "POST" && failOnce) {
      failOnce = false;
      await route.abort();
    } else await route.continue();
  });
  await page.getByRole("textbox").fill("Let us talk about pizza.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Failed to fetch" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("textbox")).toBeEnabled();
  await page.getByRole("textbox").fill("Let us talk about pizza.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByText("One more consecutive off-topic", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/mobile-session.png",
    fullPage: true,
  });
  await page.getByRole("textbox").fill("Let us talk about pizza.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByText("Incomplete · Too many consecutive off-topic turns"),
  ).toBeVisible();
});
