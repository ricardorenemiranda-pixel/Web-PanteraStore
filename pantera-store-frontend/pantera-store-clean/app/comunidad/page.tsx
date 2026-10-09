"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import ActivityFeedList from "@/components/ActivityFeedList";
import { useAuth } from "@/lib/AuthContext";
import { type ActivityFeedItem, fetchActivityFeed, fetchCommunityConfig } from "@/lib/communityApi";
import { type PlayerStats, fetchLeaderboard, fetchMyStats } from "@/lib/statsApi";
import { centsToPEN, signedCentsToPEN } from "@/lib/walletApi";

type Tab = "feed" | "rankings";

function Leaderboard({ rows, myId }: { rows: PlayerStats[]; myId: string | null }) {
  if (rows.length === 0) {
    return (
      <div className="surface-card p-8 text-center text-on-surface-variant" style={{ borderRadius: 0 }}>
        Todavía no hay suficientes partidas terminadas para armar el ranking.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto surface-card" style={{ borderRadius: 0 }}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-outline-variant">
            <th className="px-4 py-3 font-label-caps text-[10px] uppercase text-on-surface-variant">#</th>
            <th className="px-4 py-3 font-label-caps text-[10px] uppercase text-on-surface-variant">Jugador</th>
            <th className="px-4 py-3 font-label-caps text-[10px] uppercase text-on-surface-variant text-right">Partidas</th>
            <th className="px-4 py-3 font-label-caps text-[10px] uppercase text-on-surface-variant text-right">Victorias</th>
            <th className="px-4 py-3 font-label-caps text-[10px] uppercase text-on-surface-variant text-right">% Victorias</th>
            <th className="px-4 py-3 font-label-caps text-[10px] uppercase text-on-surface-variant text-right">Balance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {rows.map((r, i) => (
            <tr key={r.userId} className={r.userId === myId ? "bg-primary/5" : undefined}>
              <td className="px-4 py-3 font-body-sm text-on-surface-variant figure-nums">{i + 1}</td>
              <td className="px-4 py-3 font-body-sm text-on-surface">
                {r.displayName}
                {r.userId === myId && <span className="text-primary"> (tú)</span>}
              </td>
              <td className="px-4 py-3 font-body-sm text-on-surface-variant figure-nums text-right">{r.matchesPlayed}</td>
              <td className="px-4 py-3 font-body-sm text-on-surface figure-nums text-right">{r.wins}</td>
              <td className="px-4 py-3 font-body-sm text-on-surface-variant figure-nums text-right">{r.winRatePercent}%</td>
              <td className={`px-4 py-3 font-body-sm figure-nums text-right ${r.netCents >= 0 ? "text-primary" : "text-error"}`}>
                {signedCentsToPEN(r.netCents) === "—" ? centsToPEN(0) : signedCentsToPEN(r.netCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ComunidadPage() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("feed");
  const [feed, setFeed] = useState<ActivityFeedItem[]>([]);
  const [rankings, setRankings] = useState<PlayerStats[]>([]);
  const [myStats, setMyStats] = useState<PlayerStats | null>(null);
  const [discordUrl, setDiscordUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    Promise.all([fetchActivityFeed(), fetchLeaderboard(), fetchMyStats(), fetchCommunityConfig()])
      .then(([f, r, mine, cfg]) => {
        setFeed(f);
        setRankings(r);
        setMyStats(mine);
        setDiscordUrl(cfg.discordInviteUrl);
      })
      .catch(() => setError("No se pudo cargar la comunidad."))
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading) return <div className="min-h-screen bg-background" />;

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-center px-4">
        <div className="glass-panel p-10">
          <p className="text-on-surface-variant mb-4">Inicia sesión para ver la comunidad.</p>
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
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Comunidad</h1>
            <p className="font-body-md text-on-surface-variant">Lo que está pasando en PanteraStore, y quién va arriba en las salas.</p>
          </div>
          {discordUrl && (
            <a
              href={discordUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 flex items-center gap-2 bg-[#5865F2] text-white px-5 py-2.5 font-label-caps text-label-caps hover:brightness-110"
            >
              <span className="material-symbols-outlined text-lg">forum</span>
              Únete al Discord
            </a>
          )}
        </div>

        {myStats && myStats.matchesPlayed > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="surface-card p-4" style={{ borderRadius: 0 }}>
              <span className="font-label-caps text-[10px] uppercase text-on-surface-variant">Mis partidas</span>
              <p className="font-headline-md text-headline-md text-on-surface figure-nums">{myStats.matchesPlayed}</p>
            </div>
            <div className="surface-card p-4" style={{ borderRadius: 0 }}>
              <span className="font-label-caps text-[10px] uppercase text-on-surface-variant">Mi % de victorias</span>
              <p className="font-headline-md text-headline-md text-on-surface figure-nums">{myStats.winRatePercent}%</p>
            </div>
            <div className="surface-card p-4" style={{ borderRadius: 0 }}>
              <span className="font-label-caps text-[10px] uppercase text-on-surface-variant">Mi balance</span>
              <p className={`font-headline-md text-headline-md figure-nums ${myStats.netCents >= 0 ? "text-primary" : "text-error"}`}>
                {signedCentsToPEN(myStats.netCents) === "—" ? centsToPEN(0) : signedCentsToPEN(myStats.netCents)}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-6">
          {(
            [
              ["feed", "Actividad"],
              ["rankings", "Rankings"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-5 py-2 font-label-caps text-label-caps border transition-colors ${
                tab === id ? "bg-primary text-on-primary border-primary" : "border-outline-variant text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading && <p className="text-on-surface-variant">Cargando...</p>}
        {error && <p className="text-error font-body-sm">{error}</p>}

        {!loading && !error && tab === "feed" && <ActivityFeedList items={feed} />}
        {!loading && !error && tab === "rankings" && <Leaderboard rows={rankings} myId={user.id} />}
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
