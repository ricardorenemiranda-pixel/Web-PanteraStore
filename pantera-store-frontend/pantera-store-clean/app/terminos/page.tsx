"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/lib/AuthContext";
import { acceptTerms, fetchAuthGates } from "@/lib/trustApi";

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. Qué es PanteraStore",
    body: [
      "PanteraStore es un mercado de items de Dota 2 y, además, un espacio de salas donde varios jugadores " +
        "compiten por una entrada en efectivo: quien gana se reparte el premio, la plataforma se queda con una " +
        "comisión y quien pierde pierde su entrada.",
    ],
  },
  {
    title: "2. Quién puede usar las salas",
    body: [
      "Solo mayores de 18 años, con cuenta de Steam vinculada. La mayoría de edad es una declaración tuya, no " +
        "una verificación de identidad — declarar datos falsos es motivo de suspensión.",
      "Una persona, una cuenta. Usar varias cuentas propias o ponerte de acuerdo con otro jugador para perder a " +
        "propósito (\"farming\") es fraude y se sanciona.",
    ],
  },
  {
    title: "3. Cómo se maneja el dinero",
    body: [
      "Tu entrada se bloquea al entrar a una sala y se cobra solo si la partida se juega y termina. Si la sala " +
        "se cancela o sales antes de empezar, se te devuelve completa.",
      "Las recargas y retiros se confirman manualmente por un administrador (no hay pasarela de pago automática " +
        "todavía). Revisa los detalles y límites en tu billetera.",
      "Jugar por dinero implica riesgo real de perder lo que apuestas. No apuestes más de lo que puedes perder.",
    ],
  },
  {
    title: "4. Reportes, sanciones y disputas",
    body: [
      "Puedes reportar a otro jugador por lenguaje tóxico, griefing, trampas o amañar el resultado, con evidencia " +
        "si la tienes. Un administrador revisa cada reporte y decide si corresponde una sanción.",
      "Las sanciones son advertencia, multa (se descuenta saldo real) o suspensión (no puedes crear ni unirte a " +
        "salas mientras dure). Una sanción se puede revocar si fue un error.",
      "Si crees que el resultado de tu partida fue injusto o inválido, puedes impugnarlo dentro de las horas " +
        "siguientes a que terminó. Si el reclamo se acepta, la liquidación se revierte por completo: todos " +
        "recuperan su entrada, quien ganó no se queda con el premio y la plataforma devuelve su comisión. No se " +
        "vuelve a decidir un ganador distinto.",
    ],
  },
  {
    title: "5. Conducta esperada",
    body: [
      "Trato respetuoso con los demás jugadores. Nada de trampas, scripts, exploits ni acuerdos para manipular " +
        "resultados. El incumplimiento puede derivar en advertencia, multa o suspensión, según la gravedad.",
    ],
  },
  {
    title: "6. Datos y evidencia",
    body: [
      "Guardamos la evidencia que subas en un reporte o disputa (capturas de pantalla) para que un administrador " +
        "la revise. Solo el equipo de administración puede verla. Contiene datos personales: la tratamos con " +
        "cuidado y no la compartimos con terceros.",
    ],
  },
  {
    title: "7. Cambios en estos Términos",
    body: [
      "Si estos Términos cambian de forma relevante, se te va a pedir que los vuelvas a aceptar antes de seguir " +
        "jugando en salas.",
    ],
  },
];

export default function TerminosPage() {
  const { user, loading } = useAuth();
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    fetchAuthGates()
      .then((g) => {
        setAccepted(g.termsAccepted);
        setVersion(g.termsVersion);
      })
      .catch(() => undefined);
  }, [user]);

  async function accept() {
    if (!version) return;
    setBusy(true);
    setError("");
    try {
      await acceptTerms(version);
      setAccepted(true);
      setMessage("Aceptaste los Términos de Servicio.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar tu aceptación.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow pt-24 pb-24 px-margin-mobile md:px-margin-desktop max-w-3xl mx-auto w-full">
        <div className="bg-secondary/10 border border-secondary/20 text-on-surface px-4 py-3 font-body-sm mb-8">
          <strong>Borrador.</strong> Este texto todavía no pasó revisión legal. No reemplaza una asesoría de un
          abogado sobre juegos de azar / apuestas a distancia en Perú antes de operar con dinero real.
        </div>

        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-8">Términos de Servicio</h1>

        <div className="flex flex-col gap-8 mb-10">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="font-headline-md text-headline-md text-on-surface mb-2">{s.title}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="font-body-md text-on-surface-variant mb-2 last:mb-0">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>

        {!loading && user && (
          <div className="surface-card p-6 flex flex-col gap-3" style={{ borderRadius: 0 }}>
            {accepted === true && (
              <p className="font-body-sm text-primary">Ya aceptaste la versión vigente de estos Términos.</p>
            )}
            {accepted === false && (
              <>
                <p className="font-body-sm text-on-surface-variant">
                  Todavía no aceptaste la versión vigente (versión {version}). Sin esto no puedes crear ni unirte a
                  salas.
                </p>
                <button
                  type="button"
                  onClick={accept}
                  disabled={busy}
                  className="self-start bg-primary text-on-primary px-6 py-2.5 font-label-caps text-label-caps hover:brightness-110 disabled:opacity-50"
                >
                  {busy ? "Aceptando..." : "Aceptar Términos de Servicio"}
                </button>
              </>
            )}
            {message && <p className="font-body-sm text-primary">{message}</p>}
            {error && <p className="font-body-sm text-error">{error}</p>}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
