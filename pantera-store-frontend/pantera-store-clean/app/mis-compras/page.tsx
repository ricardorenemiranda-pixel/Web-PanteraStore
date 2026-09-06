"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/lib/AuthContext";
import { BACKEND_URL } from "@/lib/config";
import { formatPEN } from "@/lib/currency";

interface MyOrderLineItem {
  itemId: string;
  itemName: string;
  price: number;
}

interface MyOrder {
  id: string;
  tradeUrl: string;
  lineItems: MyOrderLineItem[];
  total: number;
  status: "pendiente" | "procesado" | "rechazado";
  createdAt: string;
}

const statusLabel: Record<MyOrder["status"], string> = {
  pendiente: "Pendiente",
  procesado: "Procesado",
  rechazado: "Rechazado",
};
const statusClass: Record<MyOrder["status"], string> = {
  pendiente: "bg-secondary/10 text-secondary border border-secondary/20",
  procesado: "bg-primary/10 text-primary border border-primary/20",
  rechazado: "bg-error/10 text-error border border-error/20",
};

export default function MisComprasPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetch(`${BACKEND_URL}/orders/me`, { credentials: "include" })
      .then((res) => (res.ok ? (res.json() as Promise<MyOrder[]>) : []))
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-center px-4">
        <div className="glass-panel p-10">
          <p className="text-on-surface-variant mb-4">Inicia sesión con Steam para continuar.</p>
          <Link href="/login" className="text-primary underline">
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow pt-24 pb-24 px-margin-mobile md:px-margin-desktop max-w-4xl mx-auto w-full">
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Mis Compras</h1>
        <p className="text-on-surface-variant font-body-md mb-8">
          Historial de tus solicitudes de venta a PanteraStore.
        </p>

        {loading && <p className="text-on-surface-variant">Cargando...</p>}

        {!loading && orders.length === 0 && (
          <div className="glass-panel p-8 text-center text-on-surface-variant">
            Todavía no has vendido ningún item.{" "}
            <Link href="/inventario" className="text-primary underline">
              Vende tus items
            </Link>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="glass-panel p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="font-body-sm text-on-surface-variant">
                      {new Date(order.createdAt).toLocaleString("es-PE")}
                    </p>
                    <p className="font-headline-md text-headline-md text-on-surface mt-1">
                      {formatPEN(order.total)}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 font-label-caps text-[10px] uppercase rounded-full ${statusClass[order.status]}`}
                  >
                    {statusLabel[order.status]}
                  </span>
                </div>
                <ul className="text-on-surface-variant font-body-sm space-y-1">
                  {order.lineItems.map((li) => (
                    <li key={li.itemId} className="flex justify-between">
                      <span>{li.itemName}</span>
                      <span>{formatPEN(li.price)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
