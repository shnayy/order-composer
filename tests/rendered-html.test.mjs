import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calculateTimeline } from "../app/lib/timeline-rules.mjs";

function timelineItem(orderId, waitSeconds, effectSeconds) {
  return {
    instanceId: orderId,
    order: { orderId, waitSeconds, effectSeconds },
  };
}

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
  assert.match(page, /navigator\.clipboard\.write\(\[new ClipboardItem/);
  assert.doesNotMatch(page, /link\.download|URL\.createObjectURL/);
  assert.match(page, /const cardWidth = 520/);
  assert.match(page, /const gap = 2/);
  assert.match(page, /width - padding, y \+ cardHeight - 4/);
  assert.match(page, /\$\{formatTimelinePoint\(item\.startsAt\)\} \[\$\{item\.order\.name\}\]/);
  assert.doesNotMatch(page, /左のリストから追加してください/);
});

test("applies order timeline rules by immutable order id", () => {
  const accelerated = calculateTimeline([
    timelineItem("16", 5, 0),
    timelineItem("2", 20, 90),
  ]);
  assert.equal(accelerated[1].waitSeconds, 5);
  assert.equal(accelerated[1].effectSeconds, 90);

  const atThreeMinutes = calculateTimeline([
    timelineItem("wait", 720, 0),
    timelineItem("17", 20, 90),
  ]);
  assert.equal(atThreeMinutes[1].startsAt, 180);
  assert.equal(atThreeMinutes[1].waitSeconds, 20);
  assert.equal(atThreeMinutes[1].effectSeconds, 40);

  const atTwoMinutes = calculateTimeline([
    timelineItem("wait", 780, 0),
    timelineItem("17", 20, 90),
  ]);
  assert.equal(atTwoMinutes[1].startsAt, 120);
  assert.equal(atTwoMinutes[1].waitSeconds, 20);
  assert.equal(atTwoMinutes[1].effectSeconds, 0);
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
