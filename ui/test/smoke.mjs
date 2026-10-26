import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

const base = process.env.TEST_UI_BASE || "http://localhost:5175";
const browserPath = process.env.BROWSER_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const screenshots = resolve("dist", "smoke-screenshots");
await mkdir(screenshots, { recursive: true });

const browser = await chromium.launch({ executablePath: browserPath, headless: true });
try {
  for (const [name, viewport] of Object.entries({ desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } })) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/tiket`);
    await page.getByRole("button", { name: "Login" }).click();
    await page.waitForURL(/\/dashboard/);
    await page.goto(`${base}/tiket`);
    await page.locator(".tkt-toolbar .primary-button").waitFor();
    await page.screenshot({ path: resolve(screenshots, `tiket-${name}.png`), fullPage: true });
    if (process.env.TEST_ARCHIVE === "1") {
      await page.locator(".tkt-table .tkt-row").filter({ hasText: "PGD-" }).first().click();
      await page.getByRole("button", { name: "Buka Komplain Arsip" }).waitFor();
      await page.getByRole("button", { name: /Surat Tugas \(1\)/ }).click();
      assert.match(await page.locator(".tkt-modal-body").textContent(), /ST-[A-Z0-9-]+/);
      await page.getByRole("button", { name: "Tutup", exact: true }).click();
    }
    await page.locator(".tkt-toolbar .primary-button").click();
    await page.getByLabel("Kategori").selectOption("internal");
    await page.getByLabel("Jenis").selectOption("internal_use");
    await page.getByLabel("Divisi / Lokasi Internal").waitFor();
    const modal = await page.locator(".tkt-modal").boundingBox();
    assert.ok(modal && modal.height <= viewport.height && modal.width <= viewport.width, `${name}: modal exceeds viewport`);
    await page.screenshot({ path: resolve(screenshots, `tiket-form-${name}.png`) });
    await page.getByRole("button", { name: "Tutup", exact: true }).click();
    await page.goto(`${base}/surat-tugas`);
    await page.locator(".st-table").waitFor();
    await page.locator(".user-menu-name").filter({ hasText: "Admin Multiprint" }).first().waitFor({ state: "attached" });
    try {
      await page.locator(".st-table tbody tr").filter({ hasText: "ST-" }).first().waitFor({ timeout: 15000 });
    } catch (error) {
      const details = await page.locator(".st-error, .st-table tbody").allTextContents();
      throw new Error(`${name}: Surat Tugas list did not load: ${details.join(" | ")}`, { cause: error });
    }
    await page.screenshot({ path: resolve(screenshots, `surat-tugas-${name}.png`), fullPage: true });
    if (process.env.TEST_ARCHIVE === "1") {
      await page.locator(".st-table tbody tr").filter({ hasText: "(arsip)" }).first().click();
      await page.getByText("Surat Tugas Arsip", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Tutup", exact: true }).click();
    }
    if (name === "desktop" && process.env.TEST_PDF !== "skip") {
      await page.locator(".st-table tbody tr").filter({ hasText: process.env.TEST_PDF_KIND || "Penerimaan Printer" }).first().click();
      const pdf = page.getByRole("button", { name: "PDF", exact: true });
      await pdf.waitFor();
      const [popup] = await Promise.all([page.waitForEvent("popup"), pdf.click()]);
      await popup.locator(".sheet").waitFor();
      assert.match(await popup.locator(".company h1").textContent(), /MULTI PRIMA MANDIRI SUKSES/);
      assert.match(await popup.locator(".meta").textContent(), new RegExp(process.env.TEST_PDF_REQUEST_BY || "Warehouse Multiprint"));
      assert.match(await popup.locator(".items tbody").textContent(), /[A-Z0-9-]+/);
      assert.match(await popup.locator(".signatures").textContent(), /Authorized by/);
      await popup.screenshot({ path: resolve(screenshots, "surat-tugas-pdf.png"), fullPage: true });
      await popup.close();
    }
    await page.goto(`${base}/dashboard`);
    await page.locator(".summary-card").first().waitFor();
    assert.equal(await page.locator(".summary-card").count(), 3);
    assert.match(await page.locator(".summary-grid").textContent(), /Jumlah Tiket/);
    assert.match(await page.locator(".summary-grid").textContent(), /Jumlah Surat Tugas/);
    assert.match(await page.locator(".summary-grid").textContent(), /Jumlah Printer Terpasang/);
    assert.deepEqual(errors, [], `${name}: browser errors`);
    await context.close();
  }
} finally {
  await browser.close();
}
