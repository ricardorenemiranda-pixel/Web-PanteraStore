"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import WalletHistory from "@/components/WalletHistory";
import { useAuth } from "@/lib/AuthContext";
import {
  type AdminWalletView,
  centsToPEN,
  creditTestBalance,
  fetchPlatformWallet,
  grantBonus,
  lookupWalletUser,
  type WalletView,
} from "@/lib/walletApi";

function newRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function AdminWalletPage() {
  const { user, loading: userLoading } = useAuth();
  const isAdmin = user?.role === "admin";

  const [query, setQuery] = useState("");
  const [view, setView] = useState<AdminWalletView | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [bonusAmount, setBonusAmount] = useState("");
  const [bonusReason, setBonusReason] = useState("");
  const [bonusBusy, setBonusBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [platform, setPlatform] = useState<WalletView | null>(null);

  useEffect(() => {
    if (isAdmin) fetchPlatformWallet().then(setPlatform).catch(() => setPlatform(null));
  }, [isAdmin]);

  if (userLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-center px-4">
        <div className="glass-panel p-10">
          <p className="text-on-surface-variant mb-4">
            {user ? "Tu cuenta no tiene permisos de administrador." : "Inicia sesión para continuar."}
          </p>
          <Link href={user ? "/" : "/login"} className="text-primary underline">
            {user ? "Volver al inicio" : "Iniciar sesión"}
          </Link>
        </div>
      </div>
    );
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setView(await lookupWalletUser(query.trim()));
    } catch (err) {
      setView(null);
      setError(err instanceof Error ? err.message : "No se pudo buscar al usuario.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCredit(e: React.FormEvent) {
    e.preventDefault();
    if (!view) return;
    const soles = Number(amount);
    if (!Number.isFinite(soles) || soles <= 0) {
      setError("Ingresa un monto mayor a cero.");
      return;
    }
    if (reason.trim().length < 3) {
      setError("Escribe un motivo (mínimo 3 letras).");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const amountCents = Math.round(soles * 100);
      await creditTestBalance({
        userQuery: view.user.id,
        amountCents,
        reason: reason.trim(),
        requestId: newRequestId(),
      });
      setView(await lookupWalletUser(view.user.id));
      setMessage(`Se acreditaron ${centsToPEN(amountCents)} de saldo de prueba a ${view.user.displayName}.`);
      setAmount("");
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo acreditar el saldo.");
    } finally {
      setBusy(false);
    }
  }

  async function handleBonus(e: React.FormEvent) {
    e.preventDefault();
    if (!view) return;
    const soles = Number(bonusAmount);
    if (!Number.isFinite(soles) || soles <= 0) {
      setError("Ingresa un monto mayor a cero.");
      return;
    }
    if (bonusReason.trim().length < 3) {
      setError("Escribe un motivo (mínimo 3 letras).");
      return;
    }
    setBonusBusy(true);
    setError("");
    setMessage("");
    try {
      const amountCents = Math.round(soles * 100);
      await grantBonus({
        userQuery: view.user.id,
        amountCents,
        reason: bonusReason.trim(),
        requestId: newRequestId(),
      });
      setView(await lookupWalletUser(view.user.id));
      setMessage(`Se otorgó un bono de ${centsToPEN(amountCents)} a ${view.user.displayName} (anunciado en Comunidad).`);
      setBonusAmount("");
      setBonusReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo otorgar el bono.");
    } finally {
      setBonusBusy(false);
    }
  }

  const inputClass =
    "bg-surface-container border border-on-surface/10 text-on-surface font-body-sm py-2 px-3 w-full";

  return (
    <div className="min-h-screen bg-background text-on-background font-body-md">
      <header className="fixed top-0 left-0 w-full z-50 flex items-center gap-4 px-margin-mobile md:px-margin-desktop h-16 bg-surface/80 backdrop-blur-xl border-b border-on-surface/10">
        <Link
          href="/admin"
          className="flex items-center gap-1 font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Volver al panel
        </Link>
      </header>

      <main className="pt-16">
        <div className="max-w-4xl mx-auto px-margin-mobile md:px-margin-desktop py-12">
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Billetera y saldo de prueba</h1>
          <p className="text-on-surface-variant mb-8">
            Busca a un jugador y acredítale saldo de prueba. Queda registrado en su historial como ajuste, con tu
            usuario y el motivo.
          </p>

          {platform && (
            <section className="surface-card p-6 mb-8" style={{ borderRadius: 0 }}>
              <h2 className="font-label-caps text-[10px] text-secondary uppercase tracking-wider mb-2">Caja de la plataforma</h2>
              <p className="font-headline-md text-headline-md text-primary figure-nums">
                {centsToPEN(platform.wallet.availableCents)}
              </p>
              <p className="font-body-sm text-on-surface-variant">
                Comisiones cobradas por las salas ({platform.entries.length} movimientos recientes).
              </p>
            </section>
          )}

          <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-3 mb-6">
            <input
              className={inputClass}
              placeholder="ID de usuario, SteamID64 o email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="submit"
              disabled={busy || !query.trim()}
              className="bg-primary text-on-primary px-6 py-2 font-label-caps text-label-caps hover:brightness-110 disabled:opacity-50 shrink-0"
            >
              Buscar
            </button>
          </form>

          {error && (
            <div className="mb-6 bg-error/10 border border-error/20 text-error px-4 py-3 text-body-sm">{error}</div>
          )}
          {message && (
            <div className="mb-6 bg-primary/10 border border-primary/20 text-primary px-4 py-3 text-body-sm">
              {message}
            </div>
          )}

          {view && (
            <>
              <div className="surface-card p-6 mb-6" style={{ borderRadius: 0 }}>
                <p className="font-headline-md text-headline-md text-on-surface">{view.user.displayName}</p>
                <p className="font-body-sm text-on-surface-variant">
                  {[view.user.email, view.user.steamId && `Steam ${view.user.steamId}`, `ID ${view.user.id}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <span className="font-label-caps text-[10px] uppercase text-on-surface-variant">Disponible</span>
                    <p className="font-headline-md text-headline-md text-primary figure-nums">
                      {centsToPEN(view.wallet.availableCents)}
                    </p>
                  </div>
                  <div>
                    <span className="font-label-caps text-[10px] uppercase text-on-surface-variant">Bloqueado</span>
                    <p className="font-headline-md text-headline-md text-on-surface figure-nums">
                      {centsToPEN(view.wallet.lockedCents)}
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleCredit} className="surface-card p-6 mb-10 flex flex-col gap-4" style={{ borderRadius: 0 }}>
                <h2 className="font-label-caps text-[10px] text-secondary uppercase tracking-wider">
                  Acreditar saldo de prueba
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="flex flex-col gap-1">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Monto (S/)</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      className={inputClass}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1 sm:col-span-2">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Motivo</span>
                    <input
                      className={inputClass}
                      placeholder="Ej: pruebas de salas"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="self-start bg-primary text-on-primary px-6 py-3 font-label-caps text-label-caps hover:brightness-110 disabled:opacity-50"
                >
                  {busy ? "Procesando..." : "Acreditar"}
                </button>
              </form>

              <form onSubmit={handleBonus} className="surface-card p-6 mb-10 flex flex-col gap-4" style={{ borderRadius: 0 }}>
                <div>
                  <h2 className="font-label-caps text-[10px] text-secondary uppercase tracking-wider">Otorgar bono real</h2>
                  <p className="font-body-sm text-on-surface-variant mt-1">
                    A diferencia del saldo de prueba, esto es dinero real y queda anunciado en el feed de Comunidad.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="flex flex-col gap-1">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Monto (S/)</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      className={inputClass}
                      value={bonusAmount}
                      onChange={(e) => setBonusAmount(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1 sm:col-span-2">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Motivo</span>
                    <input
                      className={inputClass}
                      placeholder="Ej: bono de bienvenida"
                      value={bonusReason}
                      onChange={(e) => setBonusReason(e.target.value)}
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={bonusBusy}
                  className="self-start bg-primary text-on-primary px-6 py-3 font-label-caps text-label-caps hover:brightness-110 disabled:opacity-50"
                >
                  {bonusBusy ? "Procesando..." : "Otorgar bono"}
                </button>
              </form>

              <h2 className="font-headline-md text-headline-md text-on-surface mb-4">Historial</h2>
              <WalletHistory entries={view.entries} showAuthor />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
