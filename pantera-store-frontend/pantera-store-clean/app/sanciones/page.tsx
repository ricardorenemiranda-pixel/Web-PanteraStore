"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/lib/AuthContext";
import { SANCTION_TYPE_LABEL, type SanctionItem, fetchMySanctions } from "@/lib/trustApi";
import { centsToPEN } from "@/lib/walletApi";

const TYPE_CLASS: Record<SanctionItem["type"], string> = {
  warning: "text-secondary border-secondary/30 bg-secondary/10",
  fine: "text-error border-error/30 bg-error/10",
  suspension: "text-error border-error/30 bg-error/10",
};

export default function MisSancionesPage() {
  const { user, loading: authLoading } = useAuth();
  const [sanctions, setSanctions] = useState<SanctionItem[]>([]);
  const [activeSuspension, setActiveSuspension] = useState<SanctionItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    fetchMySanctions()
      .then((r) => {
        setSanctions(r.sanctions);
        setActiveSuspension(r.activeSuspension);
      })
      .catch(() => setError("No se pudo cargar tus sanciones."))
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading) return <div className="min-h-screen bg-background" />;

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-center px-4">
        <div className="glass-panel p-10">
          <p className="text-on-surface-variant mb-4">Inicia sesión para ver tus sanciones.</p>
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
      <main className="flex-grow pt-24 pb-24 px-margin-mobile md:px-margin-desktop max-w-3xl mx-auto w-full">
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Mis sanciones</h1>
        <p className="font-body-md text-on-surface-variant mb-8">
          Advertencias, multas y suspensiones aplicadas a tu cuenta, con el motivo de cada una.
        </p>

        {loading && <p className="text-on-surface-variant">Cargando...</p>}
        {error && <p className="text-error font-body-sm">{error}</p>}

        {activeSuspension && (
          <div className="mb-8 bg-error/10 border border-error/30 text-on-surface px-5 py-4" style={{ borderRadius: 0 }}>
            <p className="font-headline-sm text-headline-sm text-error mb-1">Tu cuenta está suspendida</p>
            <p className="font-body-sm text-on-surface-variant">
              {activeSuspension.suspendedUntil
                ? `Hasta el ${new Date(activeSuspension.suspendedUntil).toLocaleString("es-PE")}.`
                : "De forma indefinida."}{" "}
              Motivo: {activeSuspension.reason}
            </p>
            <p className="font-body-sm text-on-surface-variant mt-1">No puedes crear ni unirte a salas mientras dure.</p>
          </div>
        )}

        {!loading && !error && sanctions.length === 0 && (
          <div className="surface-card p-8 text-center text-on-surface-variant" style={{ borderRadius: 0 }}>
            No tienes sanciones registradas.
          </div>
        )}

        {sanctions.length > 0 && (
          <div className="flex flex-col gap-3">
            {sanctions.map((s) => (
              <article key={s.id} className="surface-card p-5 flex flex-col gap-2" style={{ borderRadius: 0 }}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`px-3 py-1 border font-label-caps text-[10px] uppercase ${TYPE_CLASS[s.type]}`}>
                    {SANCTION_TYPE_LABEL[s.type]}
                  </span>
                  {s.type === "fine" && s.amountCents !== null && (
                    <span className="font-body-sm text-on-surface figure-nums">{centsToPEN(s.amountCents)}</span>
                  )}
                  {s.revokedAt && (
                    <span className="font-label-caps text-[10px] uppercase text-on-surface-variant">Revocada</span>
                  )}
                  <span className="font-body-sm text-on-surface-variant ml-auto">
                    {new Date(s.appliedAt).toLocaleString("es-PE")}
                  </span>
                </div>
                <p className="font-body-sm text-on-surface">{s.reason}</p>
                {s.revokedAt && s.revokeReason && (
                  <p className="font-body-sm text-primary">Revocada: {s.revokeReason}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
