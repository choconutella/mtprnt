import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const base = process.env.TEST_UI_BASE || "http://localhost:5175";
if (base !== "http://localhost:5175") throw new Error("Workflow smoke test may only run against the disposable UI on port 5175.");

const browser = await chromium.launch({
  executablePath: process.env.BROWSER_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/surat-tugas`);
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForURL(/\/dashboard/);
  await page.goto(`${base}/surat-tugas`);
  await page.locator(".st-toolbar .primary-button").click();
  await page.getByLabel("Jenis ST").selectOption("qc");
  await page.getByLabel("PIC Teknisi").selectOption({ index: 1 });
  await page.locator(".st-check input").first().check();
  const mpNo = (await page.locator(".st-check").first().textContent()).trim();
  const [createdResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/api/surat-tugas") && response.request().method() === "POST"),
    page.getByRole("button", { name: "Simpan", exact: true }).click()
  ]);
  assert.equal(createdResponse.status(), 201);
  const created = (await createdResponse.json()).data;
  await page.locator(".st-modal").waitFor({ state: "hidden" });
  const orderRow = page.locator(".st-table tbody tr").filter({ hasText: created.nomor_surat_tugas }).first();
  await orderRow.waitFor();
  await orderRow.click();
  await page.getByRole("button", { name: "Mulai", exact: true }).click();
  await page.locator(".st-facts").getByText("Status: progress").waitFor();
  await page.getByRole("button", { name: "Unit Printer" }).click();
  assert.match(await page.locator(".st-unit").textContent(), new RegExp(mpNo));
  await page.getByLabel("Hasil", { exact: true }).fill("Lulus pemeriksaan browser");
  await page.getByLabel("Kondisi").selectOption("ready");
  await page.getByRole("button", { name: "Simpan Hasil" }).click();
  await page.getByRole("button", { name: "Selesai Pekerjaan" }).click();
  await page.locator(".st-facts").getByText("Status: technician_completed").waitFor();
  await page.getByRole("button", { name: "Resolve", exact: true }).click();
  await page.locator(".st-facts").getByText("Status: solved").waitFor();
  assert.deepEqual(errors, []);
  console.log(`QC Surat Tugas browser flow passed for ${mpNo}.`);
} finally {
  await browser.close();
}
