"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { type CollusionPair, type DuplicateAccountGroup, fetchCollusion, fetchDuplicateAccounts } from "@/lib/trustApi";

const KIND_LABEL: Record<DuplicateAccountGroup["kind"], string> = {
  login_ip: "Misma IP de login",
  withdrawal_destination: "Mismo destino de retiro",
};

export default function AdminFraudePage() {
  const { user, loading: userLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const [duplicates, setDuplicates] = useState<DuplicateAccountGroup[]>([]);
  const [collusion, setCollusion] = useState<CollusionPair[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([fetchDuplicateAccounts(), fetchCollusion()])
      .then(([d, c]) => {
        setDuplicates(d);
        setCollusion(c);
      })
      .catch(() => setError("No se pudo cargar el reporte de antifraude."))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  if (userLoading) return <div className="min-h-screen bg-background" />;

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-center px-4">
        <div className="glass-panel p-10">
          <p className="text-on-surface-variant mb-4">{user ? "Tu cuenta no tiene permisos de administrador." : "Inicia sesión para continuar."}</p>
          <Link href={user ? "/" : "/login"} className="text-primary underline">
            {user ? "Volver al inicio" : "Iniciar sesión"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-background font-body-md">
      <header className="fixed top-0 left-0 w-full z-50 flex items-center gap-4 px-margin-mobile md:px-margin-desktop h-16 bg-surface/80 backdrop-blur-xl border-b border-on-surface/10">
        <Link href="/admin" className="flex items-center gap-1 font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Volver al panel
        </Link>
      </header>

      <main className="pt-16">
        <div className="max-w-4xl mx-auto px-margin-mobile md:px-margin-desktop py-12 flex flex-col gap-10">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Antifraude</h1>
            <p className="text-on-surface-variant">
              Señales para revisar, no acusaciones: redes compartidas (universidad, cabina, NAT móvil) también
              pueden coincidir. Decide con criterio antes de sancionar.
            </p>
          </div>

          {error && <div className="bg-error/10 border border-error/20 text-error px-4 py-3 text-body-sm">{error}</div>}
          {loading && <p className="text-on-surface-variant">Cargando...</p>}

          <section>
            <h2 className="font-label-caps text-[10px] text-secondary uppercase tracking-wider mb-3">
              Posibles cuentas duplicadas ({duplicates.length})
            </h2>
            {!loading && duplicates.length === 0 && (
              <div className="surface-card p-5 text-on-surface-variant" style={{ borderRadius: 0 }}>
                No se detectaron IPs de login ni destinos de retiro compartidos entre cuentas.
              </div>
            )}
            <div className="flex flex-col gap-3">
              {duplicates.map((g, i) => (
                <article key={`${g.kind}-${g.key}-${i}`} className="surface-card p-5 flex flex-col gap-2" style={{ borderRadius: 0 }}>
                  <span className="font-label-caps text-[10px] uppercase text-secondary border border-secondary/30 bg-secondary/10 px-2 py-1 self-start">
                    {KIND_LABEL[g.kind]}
                  </span>
                  <p className="font-body-sm text-on-surface-variant">
                    Valor compartido: <span className="figure-nums text-on-surface">{g.key}</span>
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {g.userIds.map((id, idx) => (
                      <li key={id} className="border border-outline-variant px-3 py-1 font-body-sm text-on-surface">
                        {g.userDisplayNames[idx] ?? id} <span className="text-on-surface-variant figure-nums">({id})</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-label-caps text-[10px] text-secondary uppercase tracking-wider mb-3">
              Posible colusión ("farming") ({collusion.length})
            </h2>
            <p className="font-body-sm text-on-surface-variant mb-3">
              Pares con al menos 5 partidas juntos en el mismo equipo, donde uno ganó el 85% o más de esas veces.
            </p>
            {!loading && collusion.length === 0 && (
              <div className="surface-card p-5 text-on-surface-variant" style={{ borderRadius: 0 }}>
                No se detectaron pares con ese patrón por ahora.
              </div>
            )}
            <div className="flex flex-col gap-3">
              {collusion.map((p, i) => (
                <article key={`${p.userIdA}-${p.userIdB}-${i}`} className="surface-card p-5 flex flex-col gap-2" style={{ borderRadius: 0 }}>
                  <p className="font-body-md text-on-surface">
                    <span className="font-semibold">{p.userDisplayNameA}</span> y{" "}
                    <span className="font-semibold">{p.userDisplayNameB}</span>
                  </p>
                  <p className="font-body-sm text-on-surface-variant">
                    {p.sameTeamCount} partidas juntos en el mismo equipo · {p.userDisplayNameB} ganó{" "}
                    {p.bWinsWhenSameTeam} de esas ({Math.round((p.bWinsWhenSameTeam / p.sameTeamCount) * 100)}%)
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
