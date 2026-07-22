export type OrderRecord = {
  orderId: number;
  imageFileName: string;
  name: string;
  waitSeconds: number;
  effectSeconds: number;
  categoryId: string;
  imageUrl?: string;
};

export type DataSource = "apps-script" | "csv" | "fallback" | "error";

export const CATEGORY_OPTIONS = [
  { id: "all", label: "全部" },
  { id: "attribute", label: "属性" },
  { id: "activation", label: "発動率" },
  { id: "shield", label: "盾" },
  { id: "buff_debuff", label: "バフ/デバフ" },
  { id: "reorganization", label: "再編" },
  { id: "other", label: "その他" },
  { id: "wait", label: "待機" },
] as const;

export const ORDER_CATEGORY_OPTIONS = CATEGORY_OPTIONS.filter(
  (option) => option.id !== "all" && option.id !== "wait",
);

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

function localImageUrl(imageFileName: string) {
  if (!imageFileName) return undefined;
  const path = `/order-images/${encodeURIComponent(imageFileName)}`;
  return SITE_URL ? `${SITE_URL}${path}` : path;
}

const OFFICIAL_ORDERS = [
  { orderId: 200, imageFileName: "200.png", name: "恒星の覚醒妨害", waitSeconds: 10, effectSeconds: 90, categoryId: "activation" },
  { orderId: 201, imageFileName: "201.png", name: "覚醒の恒星", waitSeconds: 10, effectSeconds: 90, categoryId: "activation" },
  { orderId: 401, imageFileName: "401.png", name: "煌天封界", waitSeconds: 10, effectSeconds: 110, categoryId: "shield" },
  { orderId: 102, imageFileName: "102.png", name: "深蒼海の神裁", waitSeconds: 20, effectSeconds: 130, categoryId: "attribute" },
  { orderId: 106, imageFileName: "106.png", name: "蒼天煌威", waitSeconds: 20, effectSeconds: 130, categoryId: "attribute" },
  { orderId: 402, imageFileName: "402.png", name: "鳳炎封界", waitSeconds: 10, effectSeconds: 110, categoryId: "shield" },
  { orderId: 103, imageFileName: "103.png", name: "煌天翼の咆哮", waitSeconds: 20, effectSeconds: 130, categoryId: "attribute" },
  { orderId: 105, imageFileName: "105.png", name: "焚天赫風", waitSeconds: 10, effectSeconds: 65, categoryId: "attribute" },
  { orderId: 403, imageFileName: "403.png", name: "蒼神封界", waitSeconds: 10, effectSeconds: 110, categoryId: "shield" },
  { orderId: 101, imageFileName: "101.png", name: "鳳炎天舞", waitSeconds: 20, effectSeconds: 130, categoryId: "attribute" },
  { orderId: 104, imageFileName: "104.png", name: "鳳蒼覇煌", waitSeconds: 10, effectSeconds: 65, categoryId: "attribute" },
  { orderId: 501, imageFileName: "501.png", name: "水刃縛りの大棘蔦", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 502, imageFileName: "502.png", name: "水鎧強化の大城壁", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 503, imageFileName: "503.png", name: "炎刃縛りの大棘蔦", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 504, imageFileName: "504.png", name: "炎鎧強化の大城壁", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 703, imageFileName: "703.png", name: "妨げの反動", waitSeconds: 20, effectSeconds: 80, categoryId: "other" },
  { orderId: 704, imageFileName: "704.png", name: "支えの反動", waitSeconds: 20, effectSeconds: 80, categoryId: "other" },
  { orderId: 705, imageFileName: "705.png", name: "妨げの祝福", waitSeconds: 20, effectSeconds: 80, categoryId: "other" },
  { orderId: 706, imageFileName: "706.png", name: "支えの祝福", waitSeconds: 20, effectSeconds: 80, categoryId: "other" },
  { orderId: 505, imageFileName: "505.png", name: "堅硬守勢の防壁", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 506, imageFileName: "506.png", name: "炎鎧強化の鉄壁", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 507, imageFileName: "507.png", name: "炎鎧の鉄壁破壊", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 508, imageFileName: "508.png", name: "炎刃激化の聖剣", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 509, imageFileName: "509.png", name: "熾烈攻勢の聖剣", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 510, imageFileName: "510.png", name: "風刃縛りの大蔦", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 511, imageFileName: "511.png", name: "風鎧強化の鉄壁", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 701, imageFileName: "701.png", name: "定めの時辰儀", waitSeconds: 30, effectSeconds: 0, categoryId: "other" },
  { orderId: 512, imageFileName: "512.png", name: "風鎧の鉄壁破壊", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 513, imageFileName: "513.png", name: "風刃激化の聖剣", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 700, imageFileName: "700.png", name: "戦術加速の陣", waitSeconds: 5, effectSeconds: 0, categoryId: "other" },
  { orderId: 514, imageFileName: "514.png", name: "水刃縛りの大蔦", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 515, imageFileName: "515.png", name: "水鎧強化の鉄壁", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 516, imageFileName: "516.png", name: "水鎧の鉄壁破壊", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 517, imageFileName: "517.png", name: "水刃激化の聖剣", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 518, imageFileName: "518.png", name: "闇鎧の鉄壁破壊", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 519, imageFileName: "519.png", name: "闇刃縛りの大蔦", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 520, imageFileName: "520.png", name: "光鎧の鉄壁破壊", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 521, imageFileName: "521.png", name: "光刃縛りの大蔦", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 522, imageFileName: "522.png", name: "闇鎧強化の鉄壁", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 523, imageFileName: "523.png", name: "闇刃激化の聖剣", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 524, imageFileName: "524.png", name: "光鎧強化の鉄壁", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 525, imageFileName: "525.png", name: "光刃激化の聖剣", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 113, imageFileName: "113.png", name: "暗碧無双", waitSeconds: 30, effectSeconds: 120, categoryId: "attribute" },
  { orderId: 114, imageFileName: "114.png", name: "玲瓏光艶", waitSeconds: 30, effectSeconds: 120, categoryId: "attribute" },
  { orderId: 115, imageFileName: "115.png", name: "陰陽二律", waitSeconds: 15, effectSeconds: 60, categoryId: "attribute" },
  { orderId: 601, imageFileName: "601.png", name: "後衛再編の陣", waitSeconds: 15, effectSeconds: 0, categoryId: "reorganization" },
  { orderId: 602, imageFileName: "602.png", name: "前衛再編の陣", waitSeconds: 15, effectSeconds: 0, categoryId: "reorganization" },
  { orderId: 107, imageFileName: "107.png", name: "光華廻風", waitSeconds: 15, effectSeconds: 60, categoryId: "attribute" },
  { orderId: 108, imageFileName: "108.png", name: "天光銀波", waitSeconds: 15, effectSeconds: 60, categoryId: "attribute" },
  { orderId: 109, imageFileName: "109.png", name: "光背火翼", waitSeconds: 15, effectSeconds: 60, categoryId: "attribute" },
  { orderId: 110, imageFileName: "110.png", name: "黒貂威風", waitSeconds: 15, effectSeconds: 60, categoryId: "attribute" },
  { orderId: 111, imageFileName: "111.png", name: "黒碑水鏡", waitSeconds: 15, effectSeconds: 60, categoryId: "attribute" },
  { orderId: 112, imageFileName: "112.png", name: "暗黒業火", waitSeconds: 15, effectSeconds: 60, categoryId: "attribute" },
  { orderId: 707, imageFileName: "707.png", name: "魔縮領域", waitSeconds: 20, effectSeconds: 80, categoryId: "other" },
  { orderId: 708, imageFileName: "708.png", name: "広域魔導凱旋", waitSeconds: 20, effectSeconds: 0, categoryId: "other" },
  { orderId: 603, imageFileName: "603.png", name: "広域再編の陣", waitSeconds: 30, effectSeconds: 0, categoryId: "reorganization" },
  { orderId: 702, imageFileName: "702.png", name: "刻戻りのクロノグラフ", waitSeconds: 30, effectSeconds: 0, categoryId: "other" },
  { orderId: 404, imageFileName: "404.png", name: "特異返しの鉄壁", waitSeconds: 30, effectSeconds: 90, categoryId: "shield" },
  { orderId: 405, imageFileName: "405.png", name: "衝撃返しの鉄壁", waitSeconds: 30, effectSeconds: 90, categoryId: "shield" },
  { orderId: 526, imageFileName: "526.png", name: "敵城砦鉄壁破壊", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 527, imageFileName: "527.png", name: "守勢強化の鉄壁", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 528, imageFileName: "528.png", name: "聖剣縛りの蔦", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 529, imageFileName: "529.png", name: "攻勢激化の聖剣", waitSeconds: 20, effectSeconds: 0, categoryId: "buff_debuff" },
  { orderId: 709, imageFileName: "709.png", name: "革命の御旗", waitSeconds: 30, effectSeconds: 120, categoryId: "other" },
] satisfies Omit<OrderRecord, "imageUrl">[];

export const FALLBACK_ORDERS: OrderRecord[] = OFFICIAL_ORDERS.map((order) => ({
  ...order,
  imageUrl: localImageUrl(order.imageFileName),
}));

const API_URL = process.env.NEXT_PUBLIC_ORDERS_API_URL?.trim();
const CSV_URL = process.env.NEXT_PUBLIC_ORDERS_CSV_URL?.trim();
const ORDERS_CACHE_KEY = "order-composer:orders:v3";

export function orderCategoryLabel(categoryId: string) {
  return CATEGORY_OPTIONS.find((option) => option.id === categoryId)?.label ?? "その他";
}

export function isApiConfigured() {
  return Boolean(API_URL);
}

function normalizeOrder(value: Record<string, unknown>): OrderRecord | null {
  const orderId = Number(value.orderId ?? value.id);
  const imageFileName = String(value.imageFileName ?? "").trim();
  const order: OrderRecord = {
    orderId,
    imageFileName,
    name: String(value.name ?? "").trim(),
    waitSeconds: Number(value.waitSeconds),
    effectSeconds: Number(value.effectSeconds),
    categoryId: String(value.categoryId ?? value.category ?? "other").trim(),
    imageUrl: value.imageUrl ? String(value.imageUrl) : localImageUrl(imageFileName),
  };
  if (!Number.isSafeInteger(order.orderId) || order.orderId <= 0 || !order.name || !Number.isFinite(order.waitSeconds) || !Number.isFinite(order.effectSeconds)) return null;
  return order;
}

export function loadCachedOrders(): OrderRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = JSON.parse(window.localStorage.getItem(ORDERS_CACHE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(stored)) return [];
    return stored
      .map((value) => normalizeOrder(value as Record<string, unknown>))
      .filter((order): order is OrderRecord => order !== null);
  } catch {
    return [];
  }
}

function cacheOrders(orders: OrderRecord[]) {
  if (typeof window === "undefined") return;
  try {
    const compactOrders = orders.map((order) => ({
      orderId: order.orderId,
      imageFileName: order.imageFileName,
      name: order.name,
      waitSeconds: order.waitSeconds,
      effectSeconds: order.effectSeconds,
      categoryId: order.categoryId,
      imageUrl: order.imageUrl === localImageUrl(order.imageFileName) ? undefined : order.imageUrl,
    }));
    window.localStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify(compactOrders));
  } catch {
    // Storage may be unavailable in private browsing. Loading still works normally.
  }
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"' && quoted && source[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function ordersFromCsv(text: string) {
  const rows = parseCsv(text);
  const headers = rows[0] ?? [];
  return rows
    .slice(1)
    .map((row) => {
      const value: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        value[header] = row[index] ?? "";
      });
      return normalizeOrder(value);
    })
    .filter((order): order is OrderRecord => order !== null);
}

export async function loadOrders(): Promise<{ orders: OrderRecord[]; source: DataSource }> {
  try {
    if (API_URL) {
      const response = await fetch(API_URL, { cache: "no-store", redirect: "follow" });
      if (!response.ok) throw new Error("API response error");
      const payload = (await response.json()) as { orders?: Record<string, unknown>[] };
      const orders = (payload.orders ?? []).map(normalizeOrder).filter((order): order is OrderRecord => order !== null);
      cacheOrders(orders);
      return { orders, source: "apps-script" };
    }
    if (CSV_URL) {
      const response = await fetch(CSV_URL, { cache: "no-store" });
      if (!response.ok) throw new Error("CSV response error");
      const orders = ordersFromCsv(await response.text());
      cacheOrders(orders);
      return { orders, source: "csv" };
    }
    return { orders: FALLBACK_ORDERS, source: "fallback" };
  } catch {
    const cachedOrders = loadCachedOrders();
    return { orders: cachedOrders.length > 0 ? cachedOrders : FALLBACK_ORDERS, source: "error" };
  }
}

async function postApi(payload: Record<string, unknown>) {
  if (!API_URL) throw new Error("スプレッドシートAPIが未接続です");
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    redirect: "follow",
  });
  if (!response.ok) throw new Error("スプレッドシートの更新に失敗しました");
  const result = (await response.json()) as {
    ok?: boolean;
    error?: string;
    orders?: Record<string, unknown>[];
  };
  if (!result.ok) throw new Error(result.error || "スプレッドシートの更新に失敗しました");
  const orders = (result.orders ?? [])
    .map(normalizeOrder)
    .filter((order): order is OrderRecord => order !== null);
  cacheOrders(orders);
  return { ...result, orders };
}

export async function saveOrderRemote(payload: {
  originalId?: number;
  order: OrderRecord;
  imageData?: string;
  imageMime?: string;
}) {
  return postApi({ action: "save", ...payload });
}

export async function deleteOrderRemote(orderId: number, imageFileName: string) {
  return postApi({ action: "delete", orderId, imageFileName });
}

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("画像を読み込めませんでした"));
    reader.readAsDataURL(file);
  });
}
