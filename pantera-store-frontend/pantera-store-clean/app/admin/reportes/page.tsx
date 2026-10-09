"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import {
  REPORT_CATEGORY_LABEL,
  REPORT_STATUS_LABEL,
  type ReportItem,
  dismissReport,
  fetchAdminReports,
  fetchReportEvidenceUrl,
  resolveReport,
} from "@/lib/trustApi";

const STATUS_CLASS: Record<ReportItem["status"], string> = {
  pending: "text-secondary border-secondary/30 bg-secondary/10",
  resolved: "text-primary border-primary/30 bg-primary/10",
  dismissed: "text-on-surface-variant border-outline-variant",
};

function EvidenceButton({ reportId }: { reportId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  return (
    <div>
      {!url ? (
        <button
          type="button"
          onClick={() => fetchReportEvidenceUrl(reportId).then(setUrl).catch(() => setError("No se pudo cargar la evidencia."))}
          className="text-primary underline font-body-sm"
        >
          Ver evidencia
        </button>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Evidencia del reporte" className="max-h-72 border border-outline-variant" />
      )}
      {error && <p className="text-error font-body-sm">{error}</p>}
    </div>
  );
}

export default function AdminReportesPage() {
  const { user, loading: userLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const [view, setView] = useState<"pending" | "all">("pending");
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    fetchAdminReports(view)
      .then(setReports)
      .catch(() => setError("No se pudieron cargar los reportes."));
  }, [view]);

  useEffect(() => {
    if (!isAdmin) return;
    load();
  }, [isAdmin, load]);

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

  async function act(id: string, work: () => Promise<unknown>) {
    setBusy(id);
    setError("");
    try {
      await work();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la acción.");
    } finally {
      setBusy(null);
    }
  }

  function resolve(r: ReportItem) {
    const note = window.prompt(`Nota al resolver el reporte contra ${r.reportedDisplayName} (se verá en su registro):`, "");
    if (note === null) return;
    const sanctionId = window.prompt(
      "Si ya aplicaste una sanción para este caso, pega aquí su ID (déjalo vacío si no aplicaste ninguna):",
      "",
    );
    void act(r.id, () => resolveReport(r.id, note, sanctionId?.trim() || undefined));
  }

  function dismiss(r: ReportItem) {
    const note = window.prompt(`Motivo para descartar el reporte contra ${r.reportedDisplayName}:`, "");
    if (!note || note.trim().length < 3) return;
    void act(r.id, () => dismissReport(r.id, note.trim()));
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
        <div className="max-w-4xl mx-auto px-margin-mobile md:px-margin-desktop py-12 flex flex-col gap-8">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Reportes de jugadores</h1>
            <p className="text-on-surface-variant">
              Toxicidad, griefing, trampas o resultados amañados, reportados por otros jugadores. Para sancionar al
              reportado, ve a <Link href="/admin/sanciones" className="text-primary underline">Sanciones</Link> y
              vuelve aquí a resolver con el ID de la sanción.
            </p>
          </div>

          <div className="flex gap-2">
            {(["pending", "all"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-5 py-2 font-label-caps text-label-caps border transition-colors ${
                  view === v ? "bg-primary text-on-primary border-primary" : "border-outline-variant text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {v === "pending" ? "Pendientes" : "Todos"}
              </button>
            ))}
          </div>

          {error && <div className="bg-error/10 border border-error/20 text-error px-4 py-3 text-body-sm">{error}</div>}

          {reports.length === 0 && (
            <div className="surface-card p-5 text-on-surface-variant" style={{ borderRadius: 0 }}>
              No hay reportes {view === "pending" ? "pendientes" : "registrados"}.
            </div>
          )}

          <div className="flex flex-col gap-3">
            {reports.map((r) => (
              <article key={r.id} className="surface-card p-5 flex flex-col gap-3" style={{ borderRadius: 0 }}>
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className={`px-3 py-1 border font-label-caps text-[10px] uppercase ${STATUS_CLASS[r.status]}`}>
                    {REPORT_STATUS_LABEL[r.status]}
                  </span>
                  <span className="font-label-caps text-[10px] uppercase text-on-surface-variant border border-outline-variant px-2 py-1">
                    {REPORT_CATEGORY_LABEL[r.category]}
                  </span>
                  <span className="font-body-sm text-on-surface-variant">{new Date(r.createdAt).toLocaleString("es-PE")}</span>
                </div>
                <p className="font-body-md text-on-surface">
                  <span className="text-on-surface-variant">{r.reporterDisplayName}</span> reportó a{" "}
                  <span className="font-semibold">{r.reportedDisplayName}</span>
                </p>
                <p className="font-body-sm text-on-surface-variant">{r.description}</p>
                <p className="font-body-sm text-on-surface-variant">
                  ID del reporte: <span className="figure-nums text-on-surface">{r.id}</span>
                  {r.matchId && <> · Partida: <span className="figure-nums text-on-surface">{r.matchId}</span></>}
                </p>
                {r.hasEvidence && <EvidenceButton reportId={r.id} />}
                {r.reviewNote && <p className="font-body-sm text-primary">Nota de revisión: {r.reviewNote}</p>}
                {r.status === "pending" && (
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/admin/sanciones?userId=${encodeURIComponent(r.reportedUserId)}&userName=${encodeURIComponent(r.reportedDisplayName)}&reportId=${encodeURIComponent(r.id)}`}
                      className="border border-outline text-on-surface px-5 py-2 font-label-caps text-label-caps hover:bg-on-surface/5"
                    >
                      Sancionar a {r.reportedDisplayName}
                    </Link>
                    <button type="button" disabled={busy === r.id} onClick={() => resolve(r)} className="bg-primary text-on-primary px-5 py-2 font-label-caps text-label-caps hover:brightness-110 disabled:opacity-50">
                      Resolver
                    </button>
                    <button type="button" disabled={busy === r.id} onClick={() => dismiss(r)} className="text-error px-4 py-2 font-label-caps text-label-caps hover:bg-error/10 disabled:opacity-50">
                      Descartar
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
