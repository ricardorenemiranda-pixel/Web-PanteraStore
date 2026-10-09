"use client";

import { useEffect, useState } from "react";

const AUTO_DISMISS_MS = 2900;
const FADE_OUT_MS = 500;
const SEEN_KEY = "pantera-intro-seen";

const WORD_1 = "PANTERA";
const WORD_2 = "STORE";
const LETTERS_START = 0.15;
const LETTER_STAGGER = 0.045;

/** Cada letra vive dentro de una "ventana" con overflow:hidden (la máscara)
 * — la letra misma arranca desplazada hacia abajo, tapada por esa ventana,
 * y se desliza hacia arriba para revelarse, como una cortina que se
 * levanta. El delay de cada una las hace revelarse en cascada. */
function AnimatedLetters({ word, startIndex, colorClass }: { word: string; startIndex: number; colorClass?: string }) {
  return (
    <>
      {word.split("").map((char, i) => (
        <span key={startIndex + i} className="intro-letter-mask">
          <span
            className={`intro-letter ${colorClass ?? ""}`}
            style={{ animationDelay: `${LETTERS_START + (startIndex + i) * LETTER_STAGGER}s` }}
          >
            {char}
          </span>
        </span>
      ))}
    </>
  );
}

/**
 * Pantalla de bienvenida tipo intro de videojuego — logo con impacto,
 * subrayado que se dibuja y tagline. Se muestra una sola vez, la primera
 * vez que alguien entra al sitio (queda guardado en localStorage) — en
 * cargas y navegaciones siguientes no vuelve a aparecer. Se puede saltar
 * con un click y respeta prefers-reduced-motion (ahí no se muestra nunca).
 */
export default function IntroSplash() {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let alreadySeen = false;
    try {
      alreadySeen = window.localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      // Almacenamiento bloqueado (navegación privada, etc.) — se trata
      // como "no visto" y se muestra la intro esa vez, sin romper nada.
    }
    if (alreadySeen) return;

    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Si no se puede guardar, la intro podría repetirse en la próxima
      // visita — no es grave, mejor que bloquear la página por esto.
    }

    setVisible(true);
    const timer = setTimeout(() => setClosing(true), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => setVisible(false), FADE_OUT_MS);
    return () => clearTimeout(timer);
  }, [closing]);

  if (!visible) return null;

  return (
    <div
      onClick={() => setClosing(true)}
      role="dialog"
      aria-label="Bienvenida a PanteraStore"
      className={`fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center cursor-pointer transition-opacity duration-500 ${
        closing ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="intro-flash absolute inset-0" />

      <div className="relative flex flex-col items-center gap-4 px-6 text-center">
        <h1 className="font-headline-xl text-4xl md:text-6xl font-bold tracking-tight text-on-surface">
          <AnimatedLetters word={WORD_1} startIndex={0} />
          <AnimatedLetters word={WORD_2} startIndex={WORD_1.length} colorClass="text-primary" />
        </h1>
        <div className="intro-underline h-[3px] w-0 bg-secondary" />
        <p className="intro-tagline font-label-caps text-label-caps text-on-surface-variant uppercase tracking-[0.3em] opacity-0">
          Compra y vende tus items de Dota 2
        </p>
      </div>

      <span className="intro-skip absolute bottom-8 font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest opacity-0">
        Click para saltar
      </span>
    </div>
  );
}
