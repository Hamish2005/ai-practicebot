import { test, expect } from "@playwright/test";
import { duplicateCharge } from "../../src/scenarios/duplicate-charge";
const o = duplicateCharge.objectives[0];
const suggestions = {
  notes: "Review this proposed behavior.",
  categories: [
    {
      title: "Recognize the issue",
      description: o.description,
      required: true,
      rationale: "Helps the customer feel heard.",
      scoringRubric: o.scoringRubric,
    },
  ],
};

test("Practice Bot suggestions are previewed, added explicitly, and editable without saving", async ({
  page,
}) => {
  let saves = 0;
  await page.route("**/api/scenarios/suggestions", (route) =>
    route.fulfill({ json: { suggestions } }),
  );
  await page.route("**/api/scenarios", (route) => {
    saves++;
    return route.fulfill({ status: 500 });
  });
  await page.goto("/scenarios/new");
  await page
    .getByPlaceholder("What has happened, and what needs to be addressed?")
    .fill("A customer was charged twice for an order.");
  await page
    .getByRole("button", { name: "Suggest rubric with Practice Bot" })
    .click();
  await expect(
    page.getByLabel("Practice Bot rubric suggestions"),
  ).toContainText("100 points");
  await expect(page.getByLabel("Category title", { exact: true })).toHaveValue(
    "",
  );
  await page
    .getByRole("button", { name: "Add Recognize the issue", exact: true })
    .click();
  await expect(page.getByLabel("Category title", { exact: true })).toHaveValue(
    "Recognize the issue",
  );
  await page
    .getByLabel("Category title", { exact: true })
    .fill("My revised category");
  await expect(
    page.getByRole("button", { name: "Added to rubric" }),
  ).toBeDisabled();
  expect(saves).toBe(0);
});

test("changed scene invalidates suggestions and manual categories survive adding a suggestion", async ({
  page,
}) => {
  await page.route("**/api/scenarios/suggestions", (route) =>
    route.fulfill({ json: { suggestions } }),
  );
  await page.goto("/scenarios/new");
  await page
    .getByPlaceholder("What has happened, and what needs to be addressed?")
    .fill("A customer was charged twice for an order.");
  await page
    .getByLabel("Category title", { exact: true })
    .fill("Keep my manual work");
  await page
    .getByRole("button", { name: "Suggest rubric with Practice Bot" })
    .click();
  const add = page.getByRole("button", {
    name: "Add Recognize the issue",
    exact: true,
  });
  await expect(add).toBeEnabled();
  await page
    .getByPlaceholder("What has happened, and what needs to be addressed?")
    .fill("A colleague has an unresolved scheduling problem.");
  await expect(add).toBeDisabled();
  await page
    .getByRole("button", { name: "Suggest rubric with Practice Bot" })
    .click();
  await expect(add).toBeEnabled();
  await add.click();
  await expect(
    page.getByLabel("Category title", { exact: true }).nth(0),
  ).toHaveValue("Keep my manual work");
  await expect(
    page.getByLabel("Category title", { exact: true }).nth(1),
  ).toHaveValue("Recognize the issue");
});
