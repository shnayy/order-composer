import { SAMPLE_IMAGE_URLS } from "./sample-images.mjs";

export type OrderRecord = {
  orderId: number;
  imageFileName: string;
  name: string;
  waitSeconds: number;
  effectSeconds: number;
  categoryId: string;
  imageUrl?: string;
};

export type DataSource = "apps-script" | "csv" | "demo" | "error";

export const CATEGORY_OPTIONS = [
  { id: "all", label: "全部" },
  { id: "attribute", label: "属性" },
  { id: "activation", label: "発動率" },
  { id: "mp", label: "MP" },
  { id: "shield", label: "盾" },
  { id: "other", label: "その他" },
  { id: "wait", label: "待機" },
] as const;

export const ORDER_CATEGORY_OPTIONS = CATEGORY_OPTIONS.filter(
  (option) => option.id !== "all" && option.id !== "wait",
);

function sampleImageUrl(orderId: number) {
  return SAMPLE_IMAGE_URLS[String(orderId) as keyof typeof SAMPLE_IMAGE_URLS];
}

export const DEMO_ORDERS: OrderRecord[] = [
  { orderId: 1, imageFileName: "1.png", imageUrl: sampleImageUrl(1), name: "火属性強化", waitSeconds: 20, effectSeconds: 100, categoryId: "attribute" },
  { orderId: 2, imageFileName: "2.png", imageUrl: sampleImageUrl(2), name: "水属性強化", waitSeconds: 15, effectSeconds: 90, categoryId: "attribute" },
  { orderId: 3, imageFileName: "3.png", imageUrl: sampleImageUrl(3), name: "風属性強化", waitSeconds: 25, effectSeconds: 110, categoryId: "attribute" },
  { orderId: 4, imageFileName: "4.png", imageUrl: sampleImageUrl(4), name: "発動率上昇", waitSeconds: 10, effectSeconds: 60, categoryId: "activation" },
  { orderId: 5, imageFileName: "5.png", imageUrl: sampleImageUrl(5), name: "連続発動", waitSeconds: 20, effectSeconds: 80, categoryId: "activation" },
  { orderId: 6, imageFileName: "6.png", imageUrl: sampleImageUrl(6), name: "確定発動", waitSeconds: 30, effectSeconds: 45, categoryId: "activation" },
  { orderId: 7, imageFileName: "7.png", imageUrl: sampleImageUrl(7), name: "MP回復", waitSeconds: 30, effectSeconds: 90, categoryId: "mp" },
  { orderId: 8, imageFileName: "8.png", imageUrl: sampleImageUrl(8), name: "MP消費軽減", waitSeconds: 15, effectSeconds: 120, categoryId: "mp" },
  { orderId: 9, imageFileName: "9.png", imageUrl: sampleImageUrl(9), name: "MP上限増加", waitSeconds: 20, effectSeconds: 150, categoryId: "mp" },
  { orderId: 10, imageFileName: "10.png", imageUrl: sampleImageUrl(10), name: "盾強化", waitSeconds: 20, effectSeconds: 120, categoryId: "shield" },
  { orderId: 11, imageFileName: "11.png", imageUrl: sampleImageUrl(11), name: "全体防御", waitSeconds: 35, effectSeconds: 90, categoryId: "shield" },
  { orderId: 12, imageFileName: "12.png", imageUrl: sampleImageUrl(12), name: "反射障壁", waitSeconds: 25, effectSeconds: 75, categoryId: "shield" },
  { orderId: 13, imageFileName: "13.png", imageUrl: sampleImageUrl(13), name: "行動加速", waitSeconds: 15, effectSeconds: 45, categoryId: "other" },
  { orderId: 14, imageFileName: "14.png", imageUrl: sampleImageUrl(14), name: "クールダウン短縮", waitSeconds: 20, effectSeconds: 100, categoryId: "other" },
  { orderId: 15, imageFileName: "15.png", imageUrl: sampleImageUrl(15), name: "効果延長", waitSeconds: 10, effectSeconds: 80, categoryId: "other" },
  { orderId: 16, imageFileName: "16.png", imageUrl: sampleImageUrl(16), name: "戦術加速の陣", waitSeconds: 5, effectSeconds: 0, categoryId: "other" },
  { orderId: 17, imageFileName: "17.png", imageUrl: sampleImageUrl(17), name: "大天光の覚醒妨害", waitSeconds: 20, effectSeconds: 90, categoryId: "other" },
];

const API_URL = process.env.NEXT_PUBLIC_ORDERS_API_URL?.trim();
const CSV_URL = process.env.NEXT_PUBLIC_ORDERS_CSV_URL?.trim();

export function orderCategoryLabel(categoryId: string) {
  return CATEGORY_OPTIONS.find((option) => option.id === categoryId)?.label ?? "その他";
}

export function isApiConfigured() {
  return Boolean(API_URL);
}

function normalizeOrder(value: Record<string, unknown>): OrderRecord | null {
  const orderId = Number(value.orderId ?? value.id);
  const order: OrderRecord = {
    orderId,
    imageFileName: String(value.imageFileName ?? "").trim(),
    name: String(value.name ?? "").trim(),
    waitSeconds: Number(value.waitSeconds),
    effectSeconds: Number(value.effectSeconds),
    categoryId: String(value.categoryId ?? value.category ?? "other").trim(),
    imageUrl: sampleImageUrl(orderId) ?? (value.imageUrl ? String(value.imageUrl) : undefined),
  };
  if (!Number.isSafeInteger(order.orderId) || order.orderId <= 0 || !order.name || !Number.isFinite(order.waitSeconds) || !Number.isFinite(order.effectSeconds)) return null;
  return order;
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
      return { orders, source: "apps-script" };
    }
    if (CSV_URL) {
      const response = await fetch(CSV_URL, { cache: "no-store" });
      if (!response.ok) throw new Error("CSV response error");
      return { orders: ordersFromCsv(await response.text()), source: "csv" };
    }
    return { orders: DEMO_ORDERS, source: "demo" };
  } catch {
    return { orders: DEMO_ORDERS, source: "error" };
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
  const result = (await response.json()) as { ok?: boolean; error?: string };
  if (!result.ok) throw new Error(result.error || "スプレッドシートの更新に失敗しました");
  return result;
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
