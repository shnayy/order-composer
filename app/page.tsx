"use client";

import Link from "next/link";
import {
  PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CATEGORY_OPTIONS,
  OrderRecord,
  loadOrders,
  orderCategoryLabel,
} from "./lib/orders";

const TIMELINE_SECONDS = 15 * 60;

type TimelineItem = {
  instanceId: string;
  order: OrderRecord;
};

type CalculatedItem = TimelineItem & {
  endsAt: number;
  remaining: number;
};

function formatTime(value: number) {
  const seconds = Math.max(0, Math.round(value));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60,
  ).padStart(2, "0")}`;
}

function moveItem(items: TimelineItem[], from: number, to: number) {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function OrderImage({ order, compact = false }: { order: OrderRecord; compact?: boolean }) {
  if (order.imageUrl) {
    return (
      <img
        className={`order-image ${compact ? "order-image--compact" : ""}`}
        src={order.imageUrl}
        alt=""
      />
    );
  }

  return (
    <span className={`order-image order-image--empty ${compact ? "order-image--compact" : ""}`}>
      {order.categoryId === "wait" ? `${order.waitSeconds}s` : order.name.slice(0, 1)}
    </span>
  );
}

export default function Home() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [category, setCategory] = useState("all");
  const [customWait, setCustomWait] = useState("45");
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragRef = useRef<{ pointerId: number; index: number } | null>(null);

  useEffect(() => {
    let active = true;
    loadOrders().then((result) => {
      if (active) setOrders(result.orders);
    });
    return () => {
      active = false;
    };
  }, []);

  const customSeconds = Math.max(1, Math.min(900, Number(customWait) || 1));
  const waitOrders = useMemo<OrderRecord[]>(
    () => [
      { orderId: "wait-10", imageFileName: "", name: "10秒待機", waitSeconds: 10, effectSeconds: 0, categoryId: "wait" },
      { orderId: "wait-20", imageFileName: "", name: "20秒待機", waitSeconds: 20, effectSeconds: 0, categoryId: "wait" },
      { orderId: "wait-30", imageFileName: "", name: "30秒待機", waitSeconds: 30, effectSeconds: 0, categoryId: "wait" },
      { orderId: "wait-custom", imageFileName: "", name: "任意待機", waitSeconds: customSeconds, effectSeconds: 0, categoryId: "wait" },
    ],
    [customSeconds],
  );

  const visibleOrders = useMemo(() => {
    if (category === "all") return orders;
    if (category === "wait") return waitOrders;
    return orders.filter((order) => order.categoryId === category);
  }, [category, orders, waitOrders]);

  const addedIds = useMemo(
    () => new Set(timeline.map((item) => item.order.orderId)),
    [timeline],
  );

  const calculated = useMemo(() => {
    let elapsed = 0;
    return timeline.map<CalculatedItem>((item) => {
      elapsed += item.order.waitSeconds + item.order.effectSeconds;
      return { ...item, endsAt: elapsed, remaining: TIMELINE_SECONDS - elapsed };
    });
  }, [timeline]);

  const remaining = TIMELINE_SECONDS - (calculated.at(-1)?.endsAt ?? 0);

  const addOrder = (order: OrderRecord) => {
    setTimeline((current) => {
      if (current.some((item) => item.order.orderId === order.orderId)) return current;
      return [...current, { instanceId: order.orderId, order: { ...order } }];
    });
  };

  const removeOrder = (orderId: string) => {
    setTimeline((current) => current.filter((item) => item.order.orderId !== orderId));
  };

  const startDragging = (
    event: ReactPointerEvent<HTMLElement>,
    index: number,
    instanceId: string,
  ) => {
    if (!event.isPrimary || (event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, index };
    setDraggingId(instanceId);
  };

  const dragOver = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-order-index]");
    if (!target) return;
    const targetIndex = Number(target.dataset.orderIndex);
    if (!Number.isInteger(targetIndex) || targetIndex === dragRef.current.index) return;
    const from = dragRef.current.index;
    setTimeline((current) => moveItem(current, from, targetIndex));
    dragRef.current.index = targetIndex;
  };

  const stopDragging = () => {
    dragRef.current = null;
    setDraggingId(null);
  };

  return (
    <main className="planner-page">
      <header className="planner-header">
        <Link className="admin-link" href="/admin">管理画面</Link>
      </header>

      <aside className={`order-library ${libraryOpen ? "is-open" : "is-closed"}`}>
        <button
          className="library-toggle"
          type="button"
          onClick={() => setLibraryOpen((value) => !value)}
          aria-label={libraryOpen ? "オーダーリストを閉じる" : "オーダーリストを開く"}
        >
          {libraryOpen ? "‹" : "›"}
        </button>

        <div className="library-content" aria-hidden={!libraryOpen}>
          <h2>オーダー</h2>
          <label className="category-select">
            <span>カテゴリ</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>

          <div className="library-list">
            {visibleOrders.map((order) => {
              const isAdded = addedIds.has(order.orderId);
              const isCustom = order.orderId === "wait-custom";
              return (
                <div className="library-entry" key={order.orderId}>
                  {isCustom && (
                    <label className="custom-wait-input">
                      <span>秒数</span>
                      <input
                        type="number"
                        min="1"
                        max="900"
                        inputMode="numeric"
                        value={customWait}
                        disabled={isAdded}
                        onChange={(event) => setCustomWait(event.target.value)}
                      />
                      <span>s</span>
                    </label>
                  )}
                  <button
                    className={`library-order ${isAdded ? "is-added" : ""}`}
                    type="button"
                    disabled={isAdded}
                    onClick={() => addOrder(order)}
                    aria-label={isAdded ? `${order.name}は追加済み` : `${order.name}を追加`}
                  >
                    <OrderImage order={order} compact />
                    <span className="library-order-copy">
                      <strong>{order.name}</strong>
                      <small>
                        待機 {order.waitSeconds}s
                        {order.effectSeconds > 0 && ` / 効果 ${order.effectSeconds}s`}
                      </small>
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      <section className={`timeline-stage ${libraryOpen ? "library-visible" : ""}`}>
        <div className="timeline-column">
          <h2>実行順</h2>
          {calculated.length === 0 ? (
            <div className="empty-timeline">左のリストから追加してください</div>
          ) : (
            <div className="timeline-list">
              {calculated.map((item, index) => (
                <article
                  className={`timeline-item ${draggingId === item.instanceId ? "is-dragging" : ""}`}
                  key={item.instanceId}
                  data-order-index={index}
                  tabIndex={0}
                  onPointerDown={(event) => startDragging(event, index, item.instanceId)}
                  onPointerMove={dragOver}
                  onPointerUp={stopDragging}
                  onPointerCancel={stopDragging}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                    event.preventDefault();
                    const target = index + (event.key === "ArrowUp" ? -1 : 1);
                    if (target >= 0 && target < timeline.length) {
                      setTimeline((current) => moveItem(current, index, target));
                    }
                  }}
                  aria-label={`${item.order.name}。ドラッグまたは上下矢印キーで並べ替え`}
                >
                  <OrderImage order={item.order} />
                  <div className="timeline-copy">
                    <h3>{item.order.name}</h3>
                    <p>
                      待機 {item.order.waitSeconds}s
                      {item.order.effectSeconds > 0 && ` / 効果 ${item.order.effectSeconds}s`}
                    </p>
                    {item.order.categoryId !== "wait" && (
                      <small>{orderCategoryLabel(item.order.categoryId)}</small>
                    )}
                  </div>
                  <button
                    className="remove-order"
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => removeOrder(item.order.orderId)}
                    aria-label={`${item.order.name}を削除`}
                  >
                    ×
                  </button>
                  <strong className={`remaining-marker ${item.remaining < 0 ? "is-over" : ""}`}>
                    {item.remaining < 0 ? `+${formatTime(-item.remaining)}` : `-${formatTime(item.remaining)}-`}
                  </strong>
                </article>
              ))}
            </div>
          )}
          <div className={`timeline-total ${remaining < 0 ? "is-over" : ""}`}>
            {remaining < 0 ? `+${formatTime(-remaining)}` : `-${formatTime(remaining)}-`}
          </div>
        </div>
      </section>
    </main>
  );
}
