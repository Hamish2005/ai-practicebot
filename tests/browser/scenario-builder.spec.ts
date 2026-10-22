import { test, expect } from "@playwright/test";
import { unlink } from "node:fs/promises";
import { join } from "node:path";

test("build, persist, edit and practice a custom rubric on mobile", async ({
  page,
}) => {
  let createdId: string | undefined;
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/scenarios");
    await page.getByRole("link", { name: "Build a scenario +" }).click();
    await page
      .getByLabel("Scenario title", { exact: true })
      .fill("Browser test: Supporting a colleague");
    await page.getByLabel("Topic", { exact: true }).fill("Team leadership");
    await page
      .getByLabel("Scenario description", { exact: true })
      .fill("A colleague feels overwhelmed by their workload.");
    await page
      .getByLabel("Learner’s role", { exact: true })
      .fill(
        "You are the team lead. Listen and agree on a manageable next step.",
      );
    await page
      .getByLabel("Practice Bot’s role", { exact: true })
      .fill("An overwhelmed colleague");
    await page
      .getByLabel("Opening message", { exact: true })
      .fill("I cannot keep up with everything this week.");
    const category = page.getByRole("group", {
      name: "Category 1",
      exact: true,
    });
    await category
      .getByLabel("Category title", { exact: true })
      .fill("Recognize the pressure");
    await category
      .getByLabel("What should the learner demonstrate?")
      .fill("Recognize how the workload affects the colleague.");
    await category
      .getByLabel("0-point criterion", { exact: true })
      .fill("Dismisses the concern.");
    await category
      .getByLabel("0-point examples", { exact: true })
      .fill("Just work harder.");
    await category
      .getByLabel("50-point criterion", { exact: true })
      .fill("A generic acknowledgment.");
    await category
      .getByLabel("50-point examples", { exact: true })
      .fill("I hear you.");
    await category
      .getByLabel("100-point criterion", { exact: true })
      .fill("Recognizes the specific pressure.");
    await category
      .getByLabel("100-point examples", { exact: true })
      .fill("That workload sounds overwhelming.");
    await page
      .getByRole("button", { name: "+ Add category", exact: true })
      .click();
    await expect(
      page.getByRole("group", { name: "Category 2", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Remove category 2" }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const savedResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/scenarios") &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Save scenario", exact: true })
      .click();
    const saved = await savedResponse;
    expect(saved.status()).toBe(201);
    createdId = (await saved.json()).record.scenario.id;
    await expect(
      page.getByText("Your scenario and rubric have been saved."),
    ).toBeVisible();
    await page.reload();
    const card = page
      .locator(".library-card")
      .filter({ hasText: "Browser test: Supporting a colleague" });
    await card.getByRole("link", { name: "Edit scenario" }).click();
    await expect(
      page.getByLabel("100-point examples", { exact: true }),
    ).toHaveValue("That workload sounds overwhelming.", { timeout: 20_000 });
    await page
      .getByLabel("Scenario title", { exact: true })
      .fill("Browser test: Updated colleague scenario");
    await page.screenshot({
      path: "test-results/scenario-builder-mobile.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Save & practice" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Browser test: Updated colleague scenario",
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Start conversation" }).click();
    await expect(page.getByRole("log")).toContainText(
      "I cannot keep up with everything this week.",
    );
    await expect(page.getByRole("log")).not.toContainText("charged twice");
    await page.getByRole("textbox").fill("That workload sounds overwhelming.");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(
      page.getByLabel("Overall score: 100 out of 100", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".category-scores li")).toHaveCount(1);
    await expect(page.locator(".category-scores")).toContainText(
      "Recognize the pressure",
    );
  } finally {
    // Remove only the JSON file created by this test, never an existing author scenario.
    if (createdId && /^[a-f0-9-]{36}$/.test(createdId))
      await unlink(
        join(
          process.env.SCENARIO_DATA_DIR ??
            join(process.cwd(), "data", "scenarios"),
          `${createdId}.json`,
        ),
      );
  }
});

test("copies the sample without overwriting it and explains invalid session boundaries", async ({
  page,
}) => {
  await page.goto("/scenarios/new?template=duplicate-charge");
  await expect(page.getByLabel("Scenario title", { exact: true })).toHaveValue(
    "Handling a Duplicate Charge (copy)",
  );
  await expect(page.locator(".rubric-editor")).toHaveCount(5);
  await page
    .getByLabel("Warn after consecutive off-topic turns", { exact: true })
    .fill("3");
  await page
    .getByRole("button", { name: "Save scenario", exact: true })
    .click();
  await expect(page.locator(".author-error")).toContainText(
    "Warning must precede termination",
  );
  await expect(page.getByLabel("Scenario title", { exact: true })).toHaveValue(
    "Handling a Duplicate Charge (copy)",
  );
});
