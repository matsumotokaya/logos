"use client";

// Inventory table with reorder actions and recent order history.

import { useState } from "react";
import type { InventoryItem, Order } from "@/lib/store";

type Props = {
  items: InventoryItem[];
  orders: Order[];
  onOrder: (itemId: string, qty: number) => Promise<void>;
};

const yen = new Intl.NumberFormat("ja-JP");

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

type StockStatus = "reorder" | "low" | "ok";

function stockStatus(item: InventoryItem): StockStatus {
  if (item.stock < item.parLevel * 0.3) return "reorder";
  if (item.stock < item.parLevel) return "low";
  return "ok";
}

const STATUS_BADGE: Record<StockStatus, { label: string; className: string }> = {
  reorder: { label: "要発注", className: "bg-red-50 text-red-700" },
  low: { label: "残りわずか", className: "bg-amber-50 text-amber-700" },
  ok: { label: "在庫OK", className: "bg-green-50 text-green-700" },
};

const BAR_COLOR: Record<StockStatus, string> = {
  reorder: "bg-red-500",
  low: "bg-amber-500",
  ok: "bg-green-500",
};

function InventoryRow({
  item,
  onOrder,
}: {
  item: InventoryItem;
  onOrder: (itemId: string, qty: number) => Promise<void>;
}) {
  const [qty, setQty] = useState(() => Math.max(item.parLevel - item.stock, 10));
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const status = stockStatus(item);
  const badge = STATUS_BADGE[status];
  const barWidth = Math.min(100, (item.stock / item.parLevel) * 100);

  const handleOrder = async () => {
    if (qty < 1 || submitting) return;
    setSubmitting(true);
    try {
      await onOrder(item.id, qty);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <tr className="border-b border-gray-100">
      <td className="py-3 pr-4">
        <p className="text-sm font-bold">
          {item.emoji} {item.name}
        </p>
        <p className="text-pretty text-xs text-gray-400">{item.spec}</p>
      </td>
      <td className="py-3 pr-4">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
          {item.category}
        </span>
      </td>
      <td className="py-3 pr-4 text-right text-sm tabular-nums">
        ¥{yen.format(item.unitPrice)}
      </td>
      <td className="py-3 pr-4">
        <p className="text-sm tabular-nums">
          <span className="font-bold">{item.stock}</span>
          <span className="text-xs text-gray-500"> / 適正 {item.parLevel}</span>
        </p>
        <div className="mt-1 h-1 w-24 rounded bg-gray-100">
          <div
            className={`h-1 rounded ${BAR_COLOR[status]}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </td>
      <td className="py-3 pr-4">
        <div className="flex flex-wrap gap-1">
          <span className={`rounded-full px-2 py-0.5 text-xs ${badge.className}`}>
            {badge.label}
          </span>
          {item.pendingQty > 0 && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 tabular-nums">
              入荷待ち{item.pendingQty}
            </span>
          )}
        </div>
      </td>
      <td className="py-3">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            aria-label="発注数量"
            className="w-16 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs tabular-nums focus:border-gray-900 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleOrder}
            disabled={submitting}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white hover:bg-gray-700 disabled:opacity-50"
          >
            発注する
          </button>
          {done && <span className="text-xs text-green-600">✓ 発注済み</span>}
        </div>
      </td>
    </tr>
  );
}

export default function InventorySection({ items, orders, onOrder }: Props) {
  const recentOrders = orders.slice(0, 5);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="border-b border-gray-200 py-2 pr-4 font-medium">アイテム</th>
              <th className="border-b border-gray-200 py-2 pr-4 font-medium">カテゴリ</th>
              <th className="border-b border-gray-200 py-2 pr-4 text-right font-medium">単価</th>
              <th className="border-b border-gray-200 py-2 pr-4 font-medium">在庫</th>
              <th className="border-b border-gray-200 py-2 pr-4 font-medium">ステータス</th>
              <th className="border-b border-gray-200 py-2 font-medium">発注</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <InventoryRow key={item.id} item={item} onOrder={onOrder} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-900">発注履歴</h3>
        {recentOrders.length === 0 ? (
          <p className="mt-2 text-xs text-gray-500">発注履歴はまだありません</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {recentOrders.map((order) => (
              <li key={order.id} className="flex justify-between text-xs text-gray-600">
                <span className="tabular-nums">
                  {formatDateTime(order.orderedAt)} {order.itemName} × {order.qty}
                </span>
                <span className="tabular-nums">
                  ¥{yen.format(order.amount)} ・ 発注済み
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
