"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/lib/AuthContext";
import { BACKEND_URL, STEAM_LOGIN_URL } from "@/lib/config";

export default function PerfilPage() {
  const { user, loading, refresh } = useAuth();
  const [tradeUrl, setTradeUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (user?.tradeUrl) setTradeUrl(user.tradeUrl);
  }, [user?.tradeUrl]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${BACKEND_URL}/auth/me`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeUrl }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message?.[0] ?? body?.message ?? "No se pudo guardar.");
      }
      await refresh();
      setMessage({ type: "success", text: "Trade URL guardado." });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Error desconocido." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-center px-4">
        <div className="glass-panel p-10">
          <p className="text-on-surface-variant mb-4">Inicia sesión para continuar.</p>
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
      <main className="flex-grow pt-24 pb-24 px-margin-mobile md:px-margin-desktop max-w-2xl mx-auto w-full">
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-8">Mi Perfil</h1>

        <div className="glass-panel p-8 flex items-center gap-4 mb-8">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt={user.displayName} className="w-16 h-16 rounded-full" />
          ) : (
            <span className="material-symbols-outlined text-primary text-[48px]">account_circle</span>
          )}
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">{user.displayName}</h2>
            <p className="text-on-surface-variant font-body-sm uppercase font-label-caps tracking-widest">
              {user.role === "admin" ? "Administrador" : "Cliente"}
            </p>
          </div>
        </div>

        {!user.steamId && (
          <div className="glass-panel p-8 mb-8">
            <h3 className="font-headline-md text-headline-md text-on-surface mb-2">
              Vincular cuenta de Steam
            </h3>
            <p className="text-on-surface-variant font-body-sm mb-6">
              Vincula tu cuenta de Steam para poder vender items de tu inventario de Dota 2.
            </p>
            <a
              href={STEAM_LOGIN_URL}
              className="steam-button py-3 px-8 rounded-lg inline-flex items-center justify-center gap-3 group"
            >
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <svg
                  className="w-5 h-5 text-white group-hover:scale-110 transition-transform duration-300"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z" />
                </svg>
              </div>
              <span className="font-headline-md text-headline-md text-white whitespace-nowrap">
                Vincular cuenta de Steam
              </span>
            </a>
          </div>
        )}

        <div className="glass-panel p-8">
          <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Steam Trade URL</h3>
          <p className="text-on-surface-variant font-body-sm mb-6">
            Guárdalo una vez y no tendrás que volver a pegarlo cada vez que vendas items.
          </p>
          <input
            type="text"
            value={tradeUrl}
            onChange={(e) => setTradeUrl(e.target.value)}
            placeholder="https://steamcommunity.com/tradeoffer/new/..."
            className="w-full bg-surface-container-lowest border border-white/10 rounded-lg p-4 font-body-sm focus:outline-none focus:border-primary transition-colors mb-4"
          />
          {message && (
            <p className={`text-body-sm mb-4 ${message.type === "error" ? "text-error" : "text-primary"}`}>
              {message.text}
            </p>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !tradeUrl.trim()}
            className="bg-primary-container text-on-primary font-headline-md py-3 px-8 flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
