"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import PaymentsPanel from "@/components/PaymentsPanel";
import WalletHistory from "@/components/WalletHistory";
import { useAuth } from "@/lib/AuthContext";
import { type WalletView, centsToPEN, fetchMyWallet } from "@/lib/walletApi";

export default function BilleteraPage() {
  const { user, loading: authLoading } = useAuth();
  const [view, setView] = useState<WalletView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWallet = useCallback(() => {
    fetchMyWallet()
      .then(setView)
      .catch(() => setError("No se pudo cargar tu billetera. Intenta de nuevo."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) loadWallet();
  }, [user, loadWallet]);

  if (authLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-center px-4">
        <div className="glass-panel p-10">
          <p className="text-on-surface-variant mb-4">Inicia sesión para ver tu billetera.</p>
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
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-8">Mi billetera</h1>

        {loading && <p className="text-on-surface-variant">Cargando...</p>}
        {error && <p className="text-error font-body-sm">{error}</p>}

        {view && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
              <div className="surface-card p-6" style={{ borderRadius: 0 }}>
                <span className="font-label-caps text-[10px] uppercase text-on-surface-variant">Disponible</span>
                <p className="font-headline-lg text-headline-lg text-primary figure-nums mt-1">
                  {centsToPEN(view.wallet.availableCents)}
                </p>
                <p className="font-body-sm text-on-surface-variant mt-1">Lo que puedes usar o retirar.</p>
              </div>
              <div className="surface-card p-6" style={{ borderRadius: 0 }}>
                <span className="font-label-caps text-[10px] uppercase text-on-surface-variant">Bloqueado</span>
                <p className="font-headline-lg text-headline-lg text-on-surface figure-nums mt-1">
                  {centsToPEN(view.wallet.lockedCents)}
                </p>
                <p className="font-body-sm text-on-surface-variant mt-1">Comprometido en salas activas y en retiros que se están revisando.</p>
              </div>
            </div>

            <PaymentsPanel availableCents={view.wallet.availableCents} onChanged={loadWallet} />

            <h2 className="font-headline-md text-headline-md text-on-surface mb-4">Movimientos</h2>
            <WalletHistory entries={view.entries} />
          </>
        )}
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
