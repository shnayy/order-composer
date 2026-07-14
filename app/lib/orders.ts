export type OrderRecord = {
  orderId: string;
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

export const DEMO_ORDERS: OrderRecord[] = [
  { orderId: "attr-fire", imageFileName: "", name: "火属性強化", waitSeconds: 20, effectSeconds: 100, categoryId: "attribute" },
  { orderId: "activation-up", imageFileName: "", name: "発動率上昇", waitSeconds: 10, effectSeconds: 60, categoryId: "activation" },
  { orderId: "mp-recover", imageFileName: "", name: "MP回復", waitSeconds: 30, effectSeconds: 90, categoryId: "mp" },
  { orderId: "shield-wall", imageFileName: "", name: "盾強化", waitSeconds: 20, effectSeconds: 120, categoryId: "shield" },
  { orderId: "other-speed", imageFileName: "", name: "行動加速", waitSeconds: 15, effectSeconds: 45, categoryId: "other" },
];

const API_URL = process.env.NEXT_PUBLIC_ORDERS_API_URL?.trim();
const CSV_URL = process.env.NEXT_PUBLIC_ORDERS_CSV_URL?.trim();

export function orderCategoryLabel(categoryId: string) {
  return CATEGORY_OPTIONS.find((option) => option.id === categoryId)?.label ?? categoryId;
}

export function isApiConfigured() {
  return Boolean(API_URL);
}

function normalizeOrder(value: Record<string, unknown>): OrderRecord | null {
  const order: OrderRecord = {
    orderId: String(value.orderId ?? value.id ?? "").trim(),
    imageFileName: String(value.imageFileName ?? "").trim(),
    name: String(value.name ?? "").trim(),
    waitSeconds: Number(value.waitSeconds),
    effectSeconds: Number(value.effectSeconds),
    categoryId: String(value.categoryId ?? value.category ?? "other").trim(),
    imageUrl: value.imageUrl ? String(value.imageUrl) : undefined,
  };
  if (!order.orderId || !order.name || !Number.isFinite(order.waitSeconds) || !Number.isFinite(order.effectSeconds)) return null;
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
  originalId?: string;
  order: OrderRecord;
  imageData?: string;
  imageMime?: string;
}) {
  return postApi({ action: "save", ...payload });
}

export async function deleteOrderRemote(orderId: string, imageFileName: string) {
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
