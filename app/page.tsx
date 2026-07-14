"use client";

import {
  PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const TIMELINE_SECONDS = 15 * 60;

type ModifierKind =
  | "none"
  | "next_wait_multiplier"
  | "next_effect_multiplier"
  | "next_wait_reduction"
  | "effect_end_at";

type OrderDefinition = {
  id: string;
  name: string;
  category: string;
  waitSeconds: number;
  effectSeconds: number;
  icon: string;
  color: string;
  description: string;
  modifierType: ModifierKind;
  modifierValue: number;
};

type TimelineOrder = {
  instanceId: string;
  orderId: string;
};

type CalculatedOrder = TimelineOrder & {
  order: OrderDefinition;
  waitSeconds: number;
  effectSeconds: number;
  startsAt: number;
  activatesAt: number;
  endsAt: number;
  remaining: number;
  isModified: boolean;
};

const FALLBACK_ORDERS: OrderDefinition[] = [
  {
    id: "rapid-deploy",
    name: "迅速展開",
    category: "戦術",
    waitSeconds: 10,
    effectSeconds: 40,
    icon: "⇢",
    color: "#55e6d2",
    description: "次のオーダーの待機時間を50%短縮",
    modifierType: "next_wait_multiplier",
    modifierValue: 0.5,
  },
  {
    id: "flame-command",
    name: "烈火の号令",
    category: "攻撃",
    waitSeconds: 20,
    effectSeconds: 100,
    icon: "炎",
    color: "#ff6b57",
    description: "前線の火力を一気に引き上げる",
    modifierType: "none",
    modifierValue: 0,
  },
  {
    id: "shock-line",
    name: "雷光陣",
    category: "攻撃",
    waitSeconds: 35,
    effectSeconds: 75,
    icon: "雷",
    color: "#ffd166",
    description: "短時間の高出力攻撃オーダー",
    modifierType: "none",
    modifierValue: 0,
  },
  {
    id: "flow-extension",
    name: "時流延長",
    category: "支援",
    waitSeconds: 15,
    effectSeconds: 50,
    icon: "∞",
    color: "#9fa8ff",
    description: "次のオーダーの効果時間を1.5倍に延長",
    modifierType: "next_effect_multiplier",
    modifierValue: 1.5,
  },
  {
    id: "still-water",
    name: "止水指令",
    category: "支援",
    waitSeconds: 30,
    effectSeconds: 90,
    icon: "水",
    color: "#61b7ff",
    description: "次のオーダーの待機時間を20秒短縮",
    modifierType: "next_wait_reduction",
    modifierValue: 20,
  },
  {
    id: "last-chapter",
    name: "終幕の断章",
    category: "特殊",
    waitSeconds: 5,
    effectSeconds: 180,
    icon: "終",
    color: "#f5a3d3",
    description: "効果はタイムライン10:00で即終了",
    modifierType: "effect_end_at",
    modifierValue: 600,
  },
  {
    id: "iron-wall",
    name: "鉄壁布陣",
    category: "防御",
    waitSeconds: 25,
    effectSeconds: 130,
    icon: "盾",
    color: "#76d7a8",
    description: "長時間、守りを固める防御オーダー",
    modifierType: "none",
    modifierValue: 0,
  },
];

const INITIAL_TIMELINE: TimelineOrder[] = [
  { instanceId: "demo-rapid", orderId: "rapid-deploy" },
  { instanceId: "demo-flame", orderId: "flame-command" },
  { instanceId: "demo-flow", orderId: "flow-extension" },
];

const MODIFIER_TYPES = new Set<ModifierKind>([
  "none",
  "next_wait_multiplier",
  "next_effect_multiplier",
  "next_wait_reduction",
  "effect_end_at",
]);

function formatTime(value: number) {
  const safeValue = Math.max(0, Math.round(value));
  const minutes = Math.floor(safeValue / 60);
  const seconds = safeValue % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
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
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("スプレッドシートにデータがありません");

  const headers = rows[0];
  const get = (row: string[], name: string) => row[headers.indexOf(name)] ?? "";

  return rows
    .slice(1)
    .map((row): OrderDefinition | null => {
      const modifierType = get(row, "modifierType") as ModifierKind;
      const order: OrderDefinition = {
        id: get(row, "id"),
        name: get(row, "name"),
        category: get(row, "category") || "その他",
        waitSeconds: Number(get(row, "waitSeconds")),
        effectSeconds: Number(get(row, "effectSeconds")),
        icon: get(row, "icon") || "◇",
        color: get(row, "color") || "#55e6d2",
        description: get(row, "description"),
        modifierType: MODIFIER_TYPES.has(modifierType) ? modifierType : "none",
        modifierValue: Number(get(row, "modifierValue")) || 0,
      };

      if (
        !order.id ||
        !order.name ||
        !Number.isFinite(order.waitSeconds) ||
        !Number.isFinite(order.effectSeconds)
      ) {
        return null;
      }
      return order;
    })
    .filter((order): order is OrderDefinition => order !== null);
}

function calculateTimeline(
  timeline: TimelineOrder[],
  definitions: Map<string, OrderDefinition>,
) {
  let elapsed = 0;
  let waitMultiplier = 1;
  let effectMultiplier = 1;
  let waitReduction = 0;
  const calculated: CalculatedOrder[] = [];

  timeline.forEach((item) => {
    const order = definitions.get(item.orderId);
    if (!order) return;

    const startsAt = elapsed;
    const waitSeconds = Math.max(
      0,
      Math.round(order.waitSeconds * waitMultiplier) - waitReduction,
    );
    let effectSeconds = Math.max(
      0,
      Math.round(order.effectSeconds * effectMultiplier),
    );
    const activatesAt = startsAt + waitSeconds;

    waitMultiplier = 1;
    effectMultiplier = 1;
    waitReduction = 0;

    if (order.modifierType === "effect_end_at") {
      effectSeconds = Math.min(
        effectSeconds,
        Math.max(0, order.modifierValue - activatesAt),
      );
    }

    const endsAt = activatesAt + effectSeconds;
    elapsed = endsAt;

    calculated.push({
      ...item,
      order,
      waitSeconds,
      effectSeconds,
      startsAt,
      activatesAt,
      endsAt,
      remaining: TIMELINE_SECONDS - endsAt,
      isModified:
        waitSeconds !== order.waitSeconds || effectSeconds !== order.effectSeconds,
    });

    if (order.modifierType === "next_wait_multiplier") {
      waitMultiplier = order.modifierValue || 1;
    } else if (order.modifierType === "next_effect_multiplier") {
      effectMultiplier = order.modifierValue || 1;
    } else if (order.modifierType === "next_wait_reduction") {
      waitReduction = order.modifierValue;
    }
  });

  return calculated;
}

function OrderGlyph({ order, compact = false }: { order: OrderDefinition; compact?: boolean }) {
  return (
    <span
      className={`order-glyph ${compact ? "order-glyph--compact" : ""}`}
      role="img"
      aria-label={`${order.name}の画像`}
      style={{ "--order-color": order.color } as React.CSSProperties}
    >
      <span>{order.icon}</span>
    </span>
  );
}

function moveItem(items: TimelineOrder[], from: number, to: number) {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export default function Home() {
  const [orders, setOrders] = useState(FALLBACK_ORDERS);
  const [timeline, setTimeline] = useState<TimelineOrder[]>(INITIAL_TIMELINE);
  const [category, setCategory] = useState("すべて");
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [dataSource, setDataSource] = useState<"demo" | "sheet" | "error">("demo");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const dragRef = useRef<{ pointerId: number; index: number } | null>(null);

  useEffect(() => {
    const sheetUrl = process.env.NEXT_PUBLIC_ORDERS_CSV_URL;
    if (!sheetUrl) return;

    const controller = new AbortController();
    fetch(sheetUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("スプレッドシートを読み込めません");
        return response.text();
      })
      .then((text) => {
        const loadedOrders = ordersFromCsv(text);
        if (!loadedOrders.length) throw new Error("有効なオーダーがありません");
        setOrders(loadedOrders);
        setTimeline([]);
        setDataSource("sheet");
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setDataSource("error");
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const definitions = useMemo(
    () => new Map(orders.map((order) => [order.id, order])),
    [orders],
  );
  const calculated = useMemo(
    () => calculateTimeline(timeline, definitions),
    [timeline, definitions],
  );
  const categories = useMemo(
    () => ["すべて", ...Array.from(new Set(orders.map((order) => order.category)))],
    [orders],
  );
  const visibleOrders = useMemo(
    () =>
      category === "すべて"
        ? orders
        : orders.filter((order) => order.category === category),
    [category, orders],
  );
  const elapsed = calculated.at(-1)?.endsAt ?? 0;
  const remaining = TIMELINE_SECONDS - elapsed;
  const usage = Math.min(100, (elapsed / TIMELINE_SECONDS) * 100);

  const addOrder = (orderId: string) => {
    setTimeline((current) => [
      ...current,
      {
        instanceId: `${orderId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        orderId,
      },
    ]);
  };

  const removeOrder = (instanceId: string) => {
    setTimeline((current) => current.filter((item) => item.instanceId !== instanceId));
  };

  const moveByKeyboard = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= timeline.length) return;
    setTimeline((current) => moveItem(current, index, target));
  };

  const startDragging = (
    event: ReactPointerEvent<HTMLButtonElement>,
    index: number,
    instanceId: string,
  ) => {
    if (!event.isPrimary) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, index };
    setDraggingId(instanceId);
  };

  const dragOver = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-order-index]");
    if (!target) return;
    const targetIndex = Number(target.dataset.orderIndex);
    if (!Number.isInteger(targetIndex) || targetIndex === dragRef.current.index) return;

    const fromIndex = dragRef.current.index;
    setTimeline((current) => moveItem(current, fromIndex, targetIndex));
    dragRef.current.index = targetIndex;
  };

  const stopDragging = () => {
    dragRef.current = null;
    setDraggingId(null);
  };

  return (
    <main className="app-shell">
      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />

      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark">OL</span>
          <div>
            <p className="eyebrow">15 MINUTE PLANNER</p>
            <h1>ORDER LINE</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <span className={`sync-state sync-state--${dataSource}`}>
            <span />
            {dataSource === "sheet"
              ? "SHEET"
              : dataSource === "error"
                ? "DEMO / SHEET ERROR"
                : "DEMO DATA"}
          </span>
          <button
            className="manage-button"
            type="button"
            onClick={() => setToast("管理画面は次のフェーズで実装します")}
            aria-label="オーダー管理画面（準備中）"
          >
            管理<span>準備中</span>
          </button>
        </div>
      </header>

      <section className="summary-bar" aria-label="タイムライン使用状況">
        <span>{formatTime(elapsed)}</span>
        <div className="summary-track">
          <span style={{ width: `${usage}%` }} />
        </div>
        <span className={remaining < 0 ? "is-over" : ""}>
          {remaining < 0 ? `+${formatTime(-remaining)}` : formatTime(remaining)}
        </span>
      </section>

      <aside className={`order-library ${libraryOpen ? "is-open" : "is-closed"}`}>
        <button
          className="library-toggle"
          type="button"
          onClick={() => setLibraryOpen((open) => !open)}
          aria-expanded={libraryOpen}
          aria-label={libraryOpen ? "オーダーリストを閉じる" : "オーダーリストを開く"}
        >
          <span>{libraryOpen ? "‹" : "›"}</span>
        </button>

        <div className="library-content" aria-hidden={!libraryOpen}>
          <div className="library-heading">
            <div>
              <p className="eyebrow">ORDER LIBRARY</p>
              <h2>オーダー</h2>
            </div>
            <span>{visibleOrders.length}</span>
          </div>

          <label className="category-select">
            <span>カテゴリ</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <div className="library-list">
            {visibleOrders.map((order) => (
              <button
                className="library-order"
                type="button"
                key={order.id}
                onClick={() => addOrder(order.id)}
                aria-label={`${order.name}をタイムラインに追加`}
              >
                <OrderGlyph order={order} compact />
                <span className="library-order-copy">
                  <strong>{order.name}</strong>
                  <small>
                    待機 {order.waitSeconds}s <i /> 効果 {order.effectSeconds}s
                  </small>
                </span>
                <span className="add-icon">＋</span>
              </button>
            ))}
          </div>
          <p className="library-hint">タップしてタイムラインへ追加</p>
        </div>
      </aside>

      <section className={`timeline-stage ${libraryOpen ? "library-visible" : ""}`}>
        <div className="time-scale" aria-hidden="true">
          {[0, 5, 10, 15].map((minute) => (
            <span key={minute} style={{ top: `${(minute / 15) * 100}%` }}>
              {String(minute).padStart(2, "0")}:00
            </span>
          ))}
        </div>

        <div className="timeline-column">
          <div className="timeline-head">
            <div>
              <p className="eyebrow">ACTIVE TIMELINE</p>
              <h2>実行順</h2>
            </div>
            <span>{timeline.length} ORDERS</span>
          </div>

          <div className="timeline-rail" aria-hidden="true" />

          {calculated.length === 0 ? (
            <div className="empty-timeline">
              <span>＋</span>
              <strong>オーダーを追加</strong>
              <p>左のリストから選ぶと、ここに上から並びます。</p>
            </div>
          ) : (
            <div className="timeline-list">
              {calculated.map((item, index) => (
                <article
                  className={`timeline-item ${
                    draggingId === item.instanceId ? "is-dragging" : ""
                  } ${item.remaining < 0 ? "is-over" : ""}`}
                  key={item.instanceId}
                  data-order-index={index}
                  style={{ "--order-color": item.order.color } as React.CSSProperties}
                >
                  <div className="order-index">{String(index + 1).padStart(2, "0")}</div>
                  <OrderGlyph order={item.order} />
                  <div className="timeline-copy">
                    <div className="timeline-title-row">
                      <div>
                        <span>{item.order.category}</span>
                        <h3>{item.order.name}</h3>
                      </div>
                      {item.isModified && <span className="modified-badge">補正</span>}
                    </div>
                    <div className="timing-row">
                      <span>
                        <small>WAIT</small>
                        <b>{item.waitSeconds}</b>s
                      </span>
                      <i />
                      <span>
                        <small>ACTIVE</small>
                        <b>{item.effectSeconds}</b>s
                      </span>
                    </div>
                    <p>{item.order.description}</p>
                  </div>

                  <button
                    className="remove-order"
                    type="button"
                    onClick={() => removeOrder(item.instanceId)}
                    aria-label={`${item.order.name}を削除`}
                  >
                    ×
                  </button>
                  <button
                    className="drag-handle"
                    type="button"
                    onPointerDown={(event) => startDragging(event, index, item.instanceId)}
                    onPointerMove={dragOver}
                    onPointerUp={stopDragging}
                    onPointerCancel={stopDragging}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowUp") {
                        event.preventDefault();
                        moveByKeyboard(index, -1);
                      } else if (event.key === "ArrowDown") {
                        event.preventDefault();
                        moveByKeyboard(index, 1);
                      }
                    }}
                    aria-label={`${item.order.name}を並べ替え。上下矢印キーでも移動できます`}
                  >
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </button>

                  <div className="remaining-marker">
                    <small>REMAIN</small>
                    <strong>
                      {item.remaining < 0
                        ? `+${formatTime(-item.remaining)}`
                        : `-${formatTime(item.remaining)}-`}
                    </strong>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className={`timeline-footer ${remaining < 0 ? "is-over" : ""}`}>
            <span>{remaining < 0 ? "LIMIT OVER" : "TIME REMAINING"}</span>
            <strong>
              {remaining < 0 ? `+${formatTime(-remaining)}` : formatTime(remaining)}
            </strong>
          </div>
        </div>
      </section>

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
