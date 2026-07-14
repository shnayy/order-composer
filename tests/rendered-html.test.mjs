import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the public planner with title-only social metadata", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>order-composer<\/title>/i);
  assert.doesNotMatch(html, /<meta[^>]+name=["']description["']/i);
  assert.match(html, /管理画面/);
});

test("keeps waits repeatable and exposes timeline copy actions", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /repeatable = order\.categoryId === "wait"/);
  assert.match(page, /画像コピー/);
  assert.match(page, /テキストコピー/);
  assert.match(page, /\$\{formatTimelinePoint\(item\.startsAt\)\} \[\$\{item\.order\.name\}\]/);
  assert.doesNotMatch(page, /左のリストから追加してください/);
});

test("uses immutable automatic numeric order ids", async () => {
  const [admin, appsScript] = await Promise.all([
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../integrations/google-apps-script/Code.gs", import.meta.url), "utf8"),
  ]);
  assert.match(admin, /追加時に自動採番/);
  assert.match(admin, /readOnly aria-readonly="true"/);
  assert.match(appsScript, /nextOrderId_\(values\)/);
  assert.match(appsScript, /const orderId = isEdit \? String\(values\[currentIndex\]\[0\]\) : nextOrderId_\(values\)/);
});
