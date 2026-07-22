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
  loadCachedOrders,
  loadOrders,
  orderCategoryLabel,
} from "./lib/orders";
import { calculateTimeline } from "./lib/timeline-rules.mjs";

const TIMELINE_SECONDS = 15 * 60;

type TimelineItem = {
  instanceId: string;
  order: OrderRecord;
};

type CalculatedItem = TimelineItem & {
  startsAt: number;
  endsAt: number;
  remaining: number;
  waitSeconds: number;
  effectSeconds: number;
};

const WAIT_ORDERS: OrderRecord[] = [
  { orderId: -10, imageFileName: "", name: "10秒待機", waitSeconds: 0, effectSeconds: 10, categoryId: "wait" },
  { orderId: -20, imageFileName: "", name: "20秒待機", waitSeconds: 0, effectSeconds: 20, categoryId: "wait" },
  { orderId: -30, imageFileName: "", name: "30秒待機", waitSeconds: 0, effectSeconds: 30, categoryId: "wait" },
];

function timeValueClass(kind: "wait" | "effect", current: number, original: number) {
  if (current === original) return "time-value";
  const isShorter = current < original;
  const isRed = kind === "wait" ? isShorter : !isShorter;
  return `time-value is-changed ${isRed ? "is-red" : "is-blue"}`;
}

function timeValueColor(kind: "wait" | "effect", current: number, original: number) {
  if (current === original) return "#4b5563";
  const isShorter = current < original;
  return (kind === "wait" ? isShorter : !isShorter) ? "#b42318" : "#4b6f9f";
}

function formatTime(value: number) {
  const seconds = Math.max(0, Math.round(value));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60,
  ).padStart(2, "0")}`;
}

function formatTimelinePoint(value: number) {
  return value < 0 ? `-${formatTime(-value)}` : formatTime(value);
}

function formatRemaining(value: number) {
  return value < 0 ? `-${formatTime(-value)}` : `-${formatTime(value)}-`;
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
      {order.categoryId === "wait" ? `${order.effectSeconds}s` : order.name.slice(0, 1)}
    </span>
  );
}

function copyWithFallback(text: string) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  textArea.remove();
}

function loadCanvasImage(url?: string) {
  if (!url) return Promise.resolve<HTMLImageElement | null>(null);
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function LoadingScreen() {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <span>読み込み中</span>
    </div>
  );
}

export default function Home() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [category, setCategory] = useState("all");
  const [customWait, setCustomWait] = useState("45");
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const dragRef = useRef<{ pointerId: number; index: number } | null>(null);
  const waitSequenceRef = useRef(0);

  useEffect(() => {
    let active = true;
    const cachedOrders = loadCachedOrders();
    if (cachedOrders.length > 0) {
      setOrders(cachedOrders);
      setLoading(false);
    }
    loadOrders()
      .then((result) => {
        if (active) setOrders(result.orders);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const customSeconds = Math.max(1, Number.parseInt(customWait, 10) || 1);

  const visibleOrders = useMemo(() => {
    if (category === "wait") return WAIT_ORDERS;
    const categoryOrders = category === "all"
      ? orders
      : orders.filter((order) => order.categoryId === category);
    return [...categoryOrders].sort((left, right) => left.orderId - right.orderId);
  }, [category, orders]);

  const addedIds = useMemo(
    () => new Set(timeline.filter((item) => item.order.categoryId !== "wait").map((item) => item.order.orderId)),
    [timeline],
  );

  const calculated = useMemo(() => {
    return calculateTimeline(timeline, TIMELINE_SECONDS) as CalculatedItem[];
  }, [timeline]);

  const remaining = TIMELINE_SECONDS - (calculated.at(-1)?.endsAt ?? 0);

  const addOrder = (order: OrderRecord) => {
    const repeatable = order.categoryId === "wait";
    const instanceId = repeatable
      ? `${order.orderId}-${Date.now()}-${waitSequenceRef.current++}`
      : String(order.orderId);
    setTimeline((current) => {
      if (!repeatable && current.some((item) => item.order.orderId === order.orderId)) return current;
      return [...current, { instanceId, order: { ...order } }];
    });
  };

  const addCustomWait = () => {
    if (!customWait) return;
    addOrder({
      orderId: -1,
      imageFileName: "",
      name: `${customSeconds}秒待機`,
      waitSeconds: 0,
      effectSeconds: customSeconds,
      categoryId: "wait",
    });
  };

  const removeOrder = (instanceId: string) => {
    setTimeline((current) => current.filter((item) => item.instanceId !== instanceId));
  };

  const showCopyStatus = (message: string) => {
    setCopyStatus(message);
    window.setTimeout(() => setCopyStatus(""), 2200);
  };

  const copyTimelineText = async () => {
    const text = calculated
      .filter((item) => item.order.categoryId !== "wait")
      .map((item) => `${formatTimelinePoint(item.startsAt)} [${item.order.name}]`)
      .join("\n");
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else copyWithFallback(text);
      showCopyStatus("コピーしました");
    } catch {
      copyWithFallback(text);
      showCopyStatus("コピーしました");
    }
  };

  const createTimelineImage = async () => {
      const width = 640;
      const padding = 24;
      const cardWidth = 520;
      const cardHeight = 64;
      const gap = 2;
      const footerHeight = 26;
      const height = padding * 2 + calculated.length * cardHeight + Math.max(0, calculated.length - 1) * gap + footerHeight;
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas unavailable");
      context.scale(scale, scale);
      context.fillStyle = "#f3f4f6";
      context.fillRect(0, 0, width, height);

      const images = await Promise.all(calculated.map((item) => loadCanvasImage(item.order.imageUrl)));
      calculated.forEach((item, index) => {
        const y = padding + index * (cardHeight + gap);
        context.fillStyle = "#ffffff";
        context.strokeStyle = "#d1d5db";
        context.lineWidth = 1;
        context.fillRect(padding, y, cardWidth, cardHeight);
        context.strokeRect(padding + 0.5, y + 0.5, cardWidth - 1, cardHeight - 1);

        const imageX = padding + 10;
        const imageY = y + 10;
        const imageSize = 44;
        const image = images[index];
        if (image) {
          const cropSize = Math.min(image.naturalWidth, image.naturalHeight);
          const sourceX = (image.naturalWidth - cropSize) / 2;
          const sourceY = (image.naturalHeight - cropSize) / 2;
          context.drawImage(image, sourceX, sourceY, cropSize, cropSize, imageX, imageY, imageSize, imageSize);
        } else {
          context.fillStyle = "#e5e7eb";
          context.fillRect(imageX, imageY, imageSize, imageSize);
          context.fillStyle = "#6b7280";
          context.font = "700 13px -apple-system, BlinkMacSystemFont, 'Yu Gothic', sans-serif";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(item.order.categoryId === "wait" ? `${item.order.effectSeconds}s` : item.order.name.slice(0, 1), imageX + imageSize / 2, imageY + imageSize / 2);
        }

        context.textAlign = "left";
        context.textBaseline = "alphabetic";
        context.fillStyle = "#1f2937";
        context.font = "700 15px -apple-system, BlinkMacSystemFont, 'Yu Gothic', sans-serif";
        context.fillText(item.order.name, imageX + imageSize + 12, y + 28, cardWidth - imageSize - 34);
        if (item.order.categoryId !== "wait") {
          let detailX = imageX + imageSize + 12;
          const detailY = y + 48;
          const drawDetail = (text: string, color = "#4b5563", changed = false) => {
            context.fillStyle = color;
            context.font = `${changed ? "700 " : ""}11px -apple-system, BlinkMacSystemFont, 'Yu Gothic', sans-serif`;
            context.fillText(text, detailX, detailY);
            detailX += context.measureText(text).width;
          };
          drawDetail("待機 ");
          drawDetail(`${item.waitSeconds}s`, timeValueColor("wait", item.waitSeconds, item.order.waitSeconds), item.waitSeconds !== item.order.waitSeconds);
          if (item.order.effectSeconds > 0 || item.effectSeconds > 0) {
            drawDetail(" / 効果 ");
            drawDetail(`${item.effectSeconds}s`, timeValueColor("effect", item.effectSeconds, item.order.effectSeconds), item.effectSeconds !== item.order.effectSeconds);
          }
        }

        context.textAlign = "right";
        context.fillStyle = item.remaining < 0 ? "#b42318" : "#4b5563";
        context.font = "11px ui-monospace, SFMono-Regular, Consolas, monospace";
        context.fillText(formatRemaining(item.remaining), width - padding, y + cardHeight - 4);
      });

      context.textAlign = "right";
      context.fillStyle = remaining < 0 ? "#b42318" : "#4b5563";
      context.font = "700 14px ui-monospace, SFMono-Regular, Consolas, monospace";
      context.fillText(formatRemaining(remaining), width - padding, height - 7);

      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error("image unavailable")), "image/png");
      });
  };

  const copyTimelineImage = async () => {
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new Error("image clipboard unavailable");
      }
      const image = createTimelineImage();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": image })]);
      showCopyStatus("画像をコピーしました");
    } catch {
      showCopyStatus("画像をコピーできませんでした");
    }
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
    <>
    {loading && <LoadingScreen />}
    <main className="planner-page" inert={loading || undefined} aria-busy={loading}>
      <header className="planner-header">
        <div className="timeline-actions">
          <button type="button" onClick={copyTimelineImage} disabled={calculated.length === 0}>画像コピー</button>
          <button type="button" onClick={copyTimelineText} disabled={!calculated.some((item) => item.order.categoryId !== "wait")}>テキストコピー</button>
          <span className="copy-status" role="status" aria-live="polite">{copyStatus}</span>
        </div>
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
              const isAdded = order.categoryId !== "wait" && addedIds.has(order.orderId);
              return (
                <div className="library-entry" key={order.orderId}>
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
                      {order.categoryId !== "wait" && (
                        <small>
                          待機 {order.waitSeconds}s
                          {order.effectSeconds > 0 && ` / 効果 ${order.effectSeconds}s`}
                        </small>
                      )}
                    </span>
                  </button>
                </div>
              );
            })}
            {category === "wait" && (
              <form className="custom-wait-row" onSubmit={(event) => { event.preventDefault(); addCustomWait(); }}>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={customWait}
                  onChange={(event) => setCustomWait(event.target.value.replace(/\D/g, ""))}
                  aria-label="任意の待機秒数"
                />
                <span>秒待機</span>
                <button type="submit" disabled={!customWait}>追加</button>
              </form>
            )}
          </div>
        </div>
      </aside>

      <section className={`timeline-stage ${libraryOpen ? "library-visible" : ""}`}>
        <div className="timeline-column">
          {calculated.length === 0 ? (
            <div className="timeline-empty" aria-label="空のタイムライン" />
          ) : (
            <div className="timeline-list">
              {calculated.map((item, index) => (
                <article
                  className={`timeline-item ${draggingId === item.instanceId ? "is-dragging" : ""}`}
                  key={item.instanceId}
                  data-order-index={index}
                  tabIndex={0}
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
                  <div
                    className="timeline-copy"
                    onPointerDown={(event) => startDragging(event, index, item.instanceId)}
                    onPointerMove={dragOver}
                    onPointerUp={stopDragging}
                    onPointerCancel={stopDragging}
                  >
                    <h3>{item.order.name}</h3>
                    {item.order.categoryId !== "wait" && (
                      <p>
                        待機 <span className={timeValueClass("wait", item.waitSeconds, item.order.waitSeconds)}>{item.waitSeconds}s</span>
                        {(item.order.effectSeconds > 0 || item.effectSeconds > 0) && (
                          <> / 効果 <span className={timeValueClass("effect", item.effectSeconds, item.order.effectSeconds)}>{item.effectSeconds}s</span></>
                        )}
                      </p>
                    )}
                    {item.order.categoryId !== "wait" && (
                      <small>{orderCategoryLabel(item.order.categoryId)}</small>
                    )}
                  </div>
                  <button
                    className="remove-order"
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => removeOrder(item.instanceId)}
                    aria-label={`${item.order.name}を削除`}
                  >
                    ×
                  </button>
                  <strong className={`remaining-marker ${item.remaining < 0 ? "is-over" : ""}`}>
                    {formatRemaining(item.remaining)}
                  </strong>
                </article>
              ))}
            </div>
          )}
          <div className={`timeline-total ${remaining < 0 ? "is-over" : ""}`}>
            {formatRemaining(remaining)}
          </div>
        </div>
      </section>
    </main>
    </>
  );
}
