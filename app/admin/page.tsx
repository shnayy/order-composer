"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  DataSource,
  ORDER_CATEGORY_OPTIONS,
  OrderRecord,
  deleteOrderRemote,
  fileToDataUrl,
  isApiConfigured,
  loadOrders,
  orderCategoryLabel,
  saveOrderRemote,
} from "../lib/orders";

type FormState = {
  mode: "add" | "edit";
  originalId: string;
  orderId: string;
  name: string;
  waitSeconds: string;
  effectSeconds: string;
  categoryId: string;
  imageFileName: string;
  imageUrl: string;
};

const EMPTY_FORM: FormState = {
  mode: "add",
  originalId: "",
  orderId: "",
  name: "",
  waitSeconds: "0",
  effectSeconds: "0",
  categoryId: "attribute",
  imageFileName: "",
  imageUrl: "",
};

function AdminImage({ order }: { order: OrderRecord }) {
  return order.imageUrl ? (
    <img className="admin-order-image" src={order.imageUrl} alt="" />
  ) : (
    <span className="admin-order-image admin-order-image--empty">{order.name.slice(0, 1)}</span>
  );
}

export default function AdminPage() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [source, setSource] = useState<DataSource>("demo");
  const [form, setForm] = useState<FormState | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<OrderRecord | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const result = await loadOrders();
    setOrders(result.orders);
    setSource(result.source);
  };

  useEffect(() => {
    refresh();
  }, []);

  const openAdd = () => {
    setForm({ ...EMPTY_FORM });
    setImageFile(null);
    setImagePreview("");
    setMessage("");
  };

  const openEdit = (order: OrderRecord) => {
    setForm({
      mode: "edit",
      originalId: order.orderId,
      orderId: order.orderId,
      name: order.name,
      waitSeconds: String(order.waitSeconds),
      effectSeconds: String(order.effectSeconds),
      categoryId: order.categoryId,
      imageFileName: order.imageFileName,
      imageUrl: order.imageUrl ?? "",
    });
    setImageFile(null);
    setImagePreview(order.imageUrl ?? "");
    setMessage("");
  };

  const closeForm = () => {
    if (busy) return;
    setForm(null);
    setImageFile(null);
    setImagePreview("");
  };

  const submitForm = async (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;
    if (!/^[A-Za-z0-9_-]+$/.test(form.orderId)) {
      setMessage("オーダーIDは半角英数字・ハイフン・アンダーバーで入力してください");
      return;
    }
    if (!form.name.trim()) {
      setMessage("オーダー名を入力してください");
      return;
    }
    if (form.mode === "add" && orders.some((order) => order.orderId === form.orderId)) {
      setMessage("同じオーダーIDが存在します");
      return;
    }
    if (form.mode === "edit" && form.orderId !== form.originalId && orders.some((order) => order.orderId === form.orderId)) {
      setMessage("変更後のオーダーIDがすでに存在します");
      return;
    }
    if (imageFile && imageFile.size > 2 * 1024 * 1024) {
      setMessage("画像は2MB以下にしてください");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const imageData = imageFile ? await fileToDataUrl(imageFile) : "";
      const extension = imageFile?.name.split(".").pop()?.toLowerCase() || "";
      const record: OrderRecord = {
        orderId: form.orderId,
        imageFileName: imageFile ? `${form.orderId}.${extension}` : form.imageFileName,
        name: form.name.trim(),
        waitSeconds: Math.max(0, Number(form.waitSeconds) || 0),
        effectSeconds: Math.max(0, Number(form.effectSeconds) || 0),
        categoryId: form.categoryId,
        imageUrl: imageData || form.imageUrl || undefined,
      };

      if (isApiConfigured()) {
        await saveOrderRemote({
          originalId: form.originalId || undefined,
          order: record,
          imageData: imageData || undefined,
          imageMime: imageFile?.type || undefined,
        });
        await refresh();
      } else {
        setOrders((current) => {
          if (form.mode === "add") return [...current, record];
          return current.map((order) => (order.orderId === form.originalId ? record : order));
        });
        setSource("demo");
        setMessage("プレビューに反映しました。API接続前なので再読み込みすると元に戻ります");
        setBusy(false);
        return;
      }
      closeForm();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    setMessage("");
    try {
      if (isApiConfigured()) {
        await deleteOrderRemote(deleteTarget.orderId, deleteTarget.imageFileName);
        await refresh();
      } else {
        setOrders((current) => current.filter((order) => order.orderId !== deleteTarget.orderId));
        setSource("demo");
      }
      setDeleteTarget(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "削除に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const sourceText = source === "apps-script"
    ? "スプレッドシート接続中"
    : source === "error"
      ? "スプレッドシート接続エラー"
      : "未接続・プレビューデータ";

  return (
    <main className="admin-page">
      <header className="admin-header">
        <Link href="/">← タイムライン</Link>
        <button type="button" className="primary-button" onClick={openAdd}>追加</button>
      </header>

      <section className="admin-content">
        <div className="admin-title-row">
          <div>
            <h1>オーダー管理</h1>
            <p className={`connection-state connection-state--${source}`}>{sourceText}</p>
          </div>
        </div>

        {message && !form && <p className="admin-message">{message}</p>}

        <div className="order-table-wrap">
          <table className="order-table">
            <thead>
              <tr>
                <th>オーダーID</th>
                <th>画像</th>
                <th>オーダー名</th>
                <th>待機時間</th>
                <th>効果時間</th>
                <th>カテゴリ</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.orderId}>
                  <td><code>{order.orderId}</code></td>
                  <td><AdminImage order={order} /></td>
                  <td>{order.name}</td>
                  <td>{order.waitSeconds}s</td>
                  <td>{order.effectSeconds}s</td>
                  <td>{orderCategoryLabel(order.categoryId)}</td>
                  <td>
                    <div className="row-actions">
                      <button type="button" onClick={() => openEdit(order)}>編集</button>
                      <button type="button" className="danger-text" onClick={() => setDeleteTarget(order)}>削除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {form && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeForm}>
          <section className="form-modal" role="dialog" aria-modal="true" aria-labelledby="form-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <h2 id="form-title">{form.mode === "add" ? "オーダー追加" : "オーダー編集"}</h2>
              <button type="button" onClick={closeForm} aria-label="閉じる">×</button>
            </div>
            <form onSubmit={submitForm}>
              <label>
                <span>オーダーID</span>
                <input value={form.orderId} onChange={(event) => setForm({ ...form, orderId: event.target.value })} required />
                <small>半角英数字・ハイフン・アンダーバー</small>
              </label>
              <label>
                <span>画像</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setImageFile(file);
                    if (file) setImagePreview(URL.createObjectURL(file));
                  }}
                />
                <small>保存名は自動で「オーダーID.拡張子」になります（最大2MB）</small>
              </label>
              {imagePreview && <img className="form-image-preview" src={imagePreview} alt="アップロード画像のプレビュー" />}
              <label>
                <span>オーダー名</span>
                <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
              </label>
              <div className="form-grid">
                <label>
                  <span>待機時間（秒）</span>
                  <input type="number" min="0" inputMode="numeric" value={form.waitSeconds} onChange={(event) => setForm({ ...form, waitSeconds: event.target.value })} required />
                </label>
                <label>
                  <span>効果時間（秒）</span>
                  <input type="number" min="0" inputMode="numeric" value={form.effectSeconds} onChange={(event) => setForm({ ...form, effectSeconds: event.target.value })} required />
                </label>
              </div>
              <label>
                <span>カテゴリID</span>
                <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
                  {ORDER_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}（{option.id}）</option>
                  ))}
                </select>
              </label>
              {message && <p className="form-message">{message}</p>}
              <button className="primary-button submit-button" type="submit" disabled={busy}>
                {busy ? "保存中..." : form.mode === "add" ? "追加" : "更新"}
              </button>
            </form>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" role="presentation">
          <section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
            <h2 id="delete-title">本当に削除しますか？</h2>
            <p>「{deleteTarget.name}」と保存画像を削除します。この操作は元に戻せません。</p>
            <div>
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={busy}>キャンセル</button>
              <button type="button" className="danger-button" onClick={confirmDelete} disabled={busy}>{busy ? "削除中..." : "削除する"}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
