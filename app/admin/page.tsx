"use client";

// Admin console: company profile, logo registry, and merch inventory/ordering.
// The repo is localStorage-backed, so all data access happens client-side.

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  repo,
  type Company,
  type InventoryItem,
  type LogoRole,
  type Order,
  type StoredLogo,
} from "@/lib/store";
import { SERVICE_NAME } from "@/lib/config";
import CompanyCard from "@/components/admin/CompanyCard";
import LogoSection from "@/components/admin/LogoSection";
import InventorySection from "@/components/admin/InventorySection";

const yen = new Intl.NumberFormat("ja-JP");

function sortOrders(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => b.orderedAt.localeCompare(a.orderedAt));
}

export default function AdminPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [logos, setLogos] = useState<StoredLogo[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      repo.getCompany(),
      repo.listLogos(),
      repo.listInventory(),
      repo.listOrders(),
    ]).then(([c, l, inv, o]) => {
      if (cancelled) return;
      setCompany(c);
      setLogos(l);
      setInventory(inv);
      setOrders(sortOrders(o));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveCompany = async (c: Company) => {
    await repo.saveCompany(c);
    setCompany(c);
  };

  const handleChangeRole = async (id: string, role: LogoRole) => {
    await repo.updateLogo(id, { role });
    setLogos(await repo.listLogos());
  };

  const handleDelete = async (id: string) => {
    const title = logos.find((l) => l.id === id)?.title ?? "";
    if (!window.confirm(`「${title}」を削除しますか？この操作は取り消せません。`)) {
      return;
    }
    await repo.deleteLogo(id);
    setLogos(await repo.listLogos());
  };

  const handleOrder = async (itemId: string, qty: number) => {
    await repo.placeOrder(itemId, qty);
    const [inv, o] = await Promise.all([repo.listInventory(), repo.listOrders()]);
    setInventory(inv);
    setOrders(sortOrders(o));
  };

  if (loading || !company) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#F7F7F8] text-[#111827]">
        <p className="text-sm text-gray-500">読み込み中…</p>
      </div>
    );
  }

  const reorderCount = inventory.filter((i) => i.stock < i.parLevel * 0.3).length;
  const pendingOrders = orders.filter((o) => o.status === "ordered");
  const pendingAmount = pendingOrders.reduce((sum, o) => sum + o.amount, 0);

  return (
    <div className="min-h-dvh bg-[#F7F7F8] text-[#111827]">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-8">
        {/* Top bar */}
        <header className="flex items-center justify-between">
          <h1 className="text-balance text-lg font-semibold">
            {SERVICE_NAME}®{" "}
            <span className="text-xs font-normal text-gray-500">管理コンソール</span>
          </h1>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
            サイトを見る →
          </Link>
        </header>

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs text-gray-500">登録ロゴ数</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{logos.length}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs text-gray-500">在庫アイテム数</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{inventory.length}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs text-gray-500">要発注アイテム数</p>
            <p
              className={`mt-1 text-3xl font-semibold tabular-nums ${
                reorderCount > 0 ? "text-red-600" : ""
              }`}
            >
              {reorderCount}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs text-gray-500">入荷待ち発注</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {pendingOrders.length}
              <span className="ml-2 text-sm font-normal text-gray-500 tabular-nums">
                ¥{yen.format(pendingAmount)}
              </span>
            </p>
          </div>
        </div>

        {/* Company profile */}
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">会社情報</h2>
            <p className="text-pretty text-xs text-gray-500">
              プレゼンテーションに表示される会社プロフィールを編集します。
            </p>
          </div>
          <CompanyCard
            company={company}
            primaryLogo={logos[0] ?? null}
            onSave={handleSaveCompany}
          />
        </section>

        {/* Logos */}
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">登録ロゴ</h2>
            <p className="text-pretty text-xs text-gray-500">
              アップロード済みのロゴの役割設定と管理を行います。
            </p>
          </div>
          <LogoSection
            logos={logos}
            onChangeRole={handleChangeRole}
            onDelete={handleDelete}
          />
        </section>

        {/* Inventory */}
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">ロゴアイテム在庫</h2>
            <p className="text-pretty text-xs text-gray-500">
              ロゴ入りアイテムの在庫状況の確認と発注を行います。
            </p>
          </div>
          <InventorySection items={inventory} orders={orders} onOrder={handleOrder} />
        </section>
      </div>
    </div>
  );
}
