import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calculateTimeline } from "../app/lib/timeline-rules.mjs";

function timelineItem(orderId, waitSeconds, effectSeconds, categoryId = "other") {
  return {
    instanceId: orderId,
    order: { orderId, waitSeconds, effectSeconds, categoryId },
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
  assert.match(page, /name: "10秒待機", waitSeconds: 0, effectSeconds: 10/);
  assert.match(page, /\.filter\(\(item\) => item\.order\.categoryId !== "wait"\)/);
  assert.match(page, /disabled={!calculated\.some\(\(item\) => item\.order\.categoryId !== "wait"\)}/);
  assert.match(page, /order\.categoryId !== "wait" && \(/);
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
    timelineItem("700", 5, 0),
    timelineItem("2", 20, 90),
  ]);
  assert.equal(accelerated[1].waitSeconds, 5);
  assert.equal(accelerated[1].effectSeconds, 90);

  const acceleratedThroughWait = calculateTimeline([
    timelineItem("700", 5, 0),
    timelineItem("wait", 0, 10, "wait"),
    timelineItem("2", 20, 90),
  ]);
  assert.equal(acceleratedThroughWait[1].waitSeconds, 0);
  assert.equal(acceleratedThroughWait[1].effectSeconds, 10);
  assert.equal(acceleratedThroughWait[2].waitSeconds, 5);

  const atThreeMinutes = calculateTimeline([
    timelineItem("wait", 720, 0),
    timelineItem("200", 20, 90),
  ]);
  assert.equal(atThreeMinutes[1].startsAt, 180);
  assert.equal(atThreeMinutes[1].waitSeconds, 20);
  assert.equal(atThreeMinutes[1].effectSeconds, 40);

  const atTwoMinutes = calculateTimeline([
    timelineItem("wait", 780, 0),
    timelineItem("200", 20, 90),
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
  assert.match(admin, /let orderId = 1/);
  assert.match(admin, /while \(usedIds\.has\(orderId\)\) orderId \+= 1/);
  assert.doesNotMatch(admin, />オーダーID</);
  assert.doesNotMatch(admin, /スプレッドシート接続中|connection-state/);
  assert.doesNotMatch(admin, /form\.orderId/);
  assert.match(admin, /<span>カテゴリ<\/span>/);
  assert.doesNotMatch(admin, /option\.label}（{option\.id}/);
  assert.match(admin, /\[\.\.\.orders\]\.sort\(\(left, right\) => left\.orderId - right\.orderId\)/);
  assert.match(admin, /sortedOrders\.map\(\(order\) =>/);
  assert.match(appsScript, /nextOrderId_\(values\)/);
  assert.match(appsScript, /const orderId = isEdit \? String\(values\[currentIndex\]\[0\]\) : nextOrderId_\(values\)/);
});

test("shows an empty timeline and highlights adjusted times", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(page, />実行順</);
  assert.match(page, /className="timeline-empty"/);
  assert.match(page, /timeValueClass\("wait"/);
  assert.match(page, /timeValueClass\("effect"/);
  assert.match(css, /\.timeline-empty[^}]+border:\s*1px dashed/s);
  assert.match(css, /\.time-value\.is-red/);
  assert.match(css, /\.time-value\.is-blue/);
});

test("keeps timeline scrolling available outside the text drag handle", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const articleStart = page.indexOf("<article");
  const copyStart = page.indexOf('<div\n                    className="timeline-copy"', articleStart);
  assert.ok(articleStart >= 0 && copyStart > articleStart);
  assert.doesNotMatch(page.slice(articleStart, copyStart), /onPointerDown|onPointerMove|onPointerUp|onPointerCancel/);
  assert.match(page.slice(copyStart), /onPointerDown=\{\(event\) => startDragging/);
  assert.match(css, /\.timeline-copy\s*\{[^}]*touch-action:\s*none/s);
  assert.doesNotMatch(css, /\.timeline-item\s*\{[^}]*touch-action:\s*none/s);
  assert.match(css, /\.remaining-marker\s*\{[^}]*right:\s*-62px[^}]*width:\s*58px/s);
});

test("blocks interaction while loading and reuses cached orders", async () => {
  const [page, admin, orders, css, appsScript] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/orders.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../integrations/google-apps-script/Code.gs", import.meta.url), "utf8"),
  ]);
  for (const source of [page, admin]) {
    assert.match(source, /loadCachedOrders\(\)/);
    assert.match(source, /loading && <LoadingScreen \/>/);
    assert.match(source, /inert={loading \|\| undefined}/);
    assert.match(source, />読み込み中</);
  }
  assert.match(orders, /order-composer:orders:v4/);
  assert.match(orders, /window\.localStorage\.setItem/);
  assert.match(orders, /cachedOrders\.length > 0 \? cachedOrders : FALLBACK_ORDERS/);
  assert.match(admin, /setOrders\(result\.orders\)/);
  assert.doesNotMatch(admin, /await refresh\(\)/);
  assert.match(css, /\.loading-screen[^}]+position:\s*fixed[^}]+z-index:\s*1000/s);
  assert.match(appsScript, /CacheService\.getScriptCache\(\)/);
  assert.match(appsScript, /function imageUrls_\(\)/);
  assert.doesNotMatch(appsScript, /function imageUrl_\(fileName\)/);
});

test("offers the buff/debuff and reorganization categories", async () => {
  const [page, orders] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/orders.ts", import.meta.url), "utf8"),
  ]);
  assert.match(orders, /\{ id: "buff_debuff", label: "バフ\/デバフ" \}/);
  assert.match(orders, /\{ id: "reorganization", label: "再編" \}/);
  assert.doesNotMatch(orders, /\{ id: "mp"/);
  assert.doesNotMatch(orders, /\{ id: "all", label: "全部" \}/);
  assert.match(orders, /option\.id !== "wait"/);
  assert.match(page, /useState\("attribute"\)/);
  assert.doesNotMatch(page, /category === "all"/);
});

test("uses the official spreadsheet data and image naming", async () => {
  const [page, orders, csv, appsScript] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/orders.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/orders.csv", import.meta.url), "utf8"),
    readFile(new URL("../integrations/google-apps-script/Code.gs", import.meta.url), "utf8"),
  ]);
  assert.match(orders, /name: "恒星の覚醒妨害"/);
  assert.match(orders, /name: "革命の御旗"/);
  assert.doesNotMatch(orders, /DEMO_ORDERS|MP回復|sampleImageUrl/);
  assert.equal(csv.trim().split(/\r?\n/).length, 65);
  assert.match(appsScript, /15OY1woERaiunJXR9kj13lvlId3ifOoBbWPL00KCzMl8/);
  assert.doesNotMatch(appsScript, /1HCuiyFvvpyZ6mtL6hHhHgRA-uwKdZ3L9X9FKOKebFbc/);
  assert.match(appsScript, /order-composer-orders-v4/);
  assert.match(appsScript, /https:\/\/lh3\.googleusercontent\.com\/d\/\$\{file\.getId\(\)\}/);
  assert.match(appsScript, /while \(usedIds\.has\(orderId\)\) orderId \+= 1/);
  assert.match(page, /sort\(\(left, right\) => left\.orderId - right\.orderId\)/);
});
