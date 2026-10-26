import assert from "node:assert/strict";
import { chromium } from "playwright-core";

if (process.env.TEST_LIVE_FLOW_CONFIRM !== "yes" || !process.env.TEST_LIVE_MP_NO) {
  throw new Error("Set TEST_LIVE_FLOW_CONFIRM=yes and TEST_LIVE_MP_NO to run this persistent production-data smoke test.");
}

const base = "http://localhost:5173";
const mpNo = process.env.TEST_LIVE_MP_NO;
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/tiket`);
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForURL(/\/dashboard/);
  await page.goto(`${base}/tiket`);
  await page.locator(".tkt-toolbar .primary-button").click();
  await page.getByLabel("Kategori").selectOption("internal");
  await page.getByLabel("Jenis").selectOption("qc");
  await page.getByLabel("Cari MP No / serial").fill(mpNo);
  await page.locator(".tkt-units label").filter({ hasText: mpNo }).locator("input").check();
  await page.getByLabel("Deskripsi").fill("Verifikasi rilis alur Tiket dan Surat Tugas");
  const [ticketResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/api/tiket") && response.request().method() === "POST"),
    page.getByRole("button", { name: "Simpan", exact: true }).click()
  ]);
  assert.equal(ticketResponse.status(), 201);
  const ticket = (await ticketResponse.json()).data;
  await page.locator(".tkt-modal").waitFor({ state: "hidden" });

  await page.goto(`${base}/surat-tugas`);
  await page.locator(".st-toolbar .primary-button").click();
  await page.getByLabel("Tiket (opsional)").selectOption(ticket.id);
  assert.equal(await page.getByLabel("Jenis ST").inputValue(), "qc");
  await page.getByLabel("PIC Teknisi").selectOption({ index: 1 });
  const [orderResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/api/surat-tugas") && response.request().method() === "POST"),
    page.getByRole("button", { name: "Simpan", exact: true }).click()
  ]);
  assert.equal(orderResponse.status(), 201);
  const order = (await orderResponse.json()).data;
  await page.locator(".st-modal").waitFor({ state: "hidden" });
  await page.locator(".st-table tbody tr").filter({ hasText: order.nomor_surat_tugas }).click();
  await page.getByRole("button", { name: "Mulai", exact: true }).click();
  await page.locator(".st-facts").getByText("Status: progress").waitFor();
  await page.getByRole("button", { name: "Unit Printer" }).click();
  assert.match(await page.locator(".st-unit").textContent(), new RegExp(mpNo));
  await page.getByLabel("Hasil", { exact: true }).fill("Lulus QC verifikasi rilis");
  await page.getByLabel("Kondisi").selectOption("ready");
  await page.getByRole("button", { name: "Simpan Hasil" }).click();
  await page.getByRole("button", { name: "Selesai Pekerjaan" }).click();
  await page.locator(".st-facts").getByText("Status: technician_completed").waitFor();
  await page.getByRole("button", { name: "Resolve", exact: true }).click();
  await page.locator(".st-facts").getByText("Status: solved").waitFor();
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: "PDF", exact: true }).click()
  ]);
  await popup.locator(".sheet").waitFor();
  assert.match(await popup.locator(".items").textContent(), new RegExp(mpNo));
  await popup.close();

  await page.goto(`${base}/tiket`);
  await page.locator(".tkt-row").filter({ hasText: ticket.nomor_tiket }).click();
  const [resolveResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().endsWith(`/api/tiket/${ticket.id}/resolve`) && response.request().method() === "POST"),
    page.getByRole("button", { name: "Resolve", exact: true }).click()
  ]);
  assert.equal(resolveResponse.status(), 200);
  assert.equal((await resolveResponse.json()).data.status, "solved");
  assert.deepEqual(errors, []);
  console.log(`Live flow passed: ${ticket.nomor_tiket} / ${order.nomor_surat_tugas} / ${mpNo}`);
} finally {
  await browser.close();
}
