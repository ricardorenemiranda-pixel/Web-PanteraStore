"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";
import { STEAM_LOGIN_URL } from "@/lib/config";
import { useAuth } from "@/lib/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background selection:bg-primary/30">
      <main className="flex-grow flex items-center justify-center px-margin-mobile relative">
        <div className="glow-effect top-1/4 left-1/4 blur-3xl opacity-20" />
        <div className="glow-effect bottom-1/4 right-1/4 blur-3xl opacity-20" />
        <div className="w-full max-w-md">
          <div className="glass-panel p-10 md:p-12 flex flex-col items-center text-center rounded-xl relative overflow-hidden">
            <div className="mb-10 group cursor-default">
              <span className="font-headline-xl text-headline-xl font-extrabold text-primary tracking-tighter block leading-none">
                PANTERASTORE
              </span>
              <div className="h-1 w-0 group-hover:w-full bg-primary mx-auto transition-all duration-500 rounded-full mt-2" />
            </div>
            <div className="space-y-4 mb-8">
              <p className="font-body-lg text-body-lg text-on-surface-variant">
                Inicia sesión para ver y vender tus items
              </p>
              <p className="font-label-caps text-label-caps text-tertiary uppercase tracking-widest opacity-60">
                Mercado Seguro de Coleccionables
              </p>
            </div>

            <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3 mb-6 text-left">
              <input
                type="email"
                required
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface-container-lowest border border-on-surface/10 rounded-lg p-4 font-body-sm focus:outline-none focus:border-primary transition-colors"
              />
              <input
                type="password"
                required
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-container-lowest border border-on-surface/10 rounded-lg p-4 font-body-sm focus:outline-none focus:border-primary transition-colors"
              />
              {error && <p className="text-error font-body-sm">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="bg-primary text-on-primary font-headline-md py-4 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {submitting ? "Ingresando..." : "Iniciar sesión"}
              </button>
              <p className="font-body-sm text-on-surface-variant">
                ¿No tienes cuenta?{" "}
                <Link href="/registro" className="text-primary underline">
                  Regístrate
                </Link>
              </p>
            </form>

            <div className="w-full flex items-center gap-4 mb-6">
              <div className="h-px flex-grow bg-on-surface/10" />
              <span className="font-label-caps text-label-caps text-on-surface-variant/50 uppercase tracking-widest">
                o
              </span>
              <div className="h-px flex-grow bg-on-surface/10" />
            </div>

            <div className="w-full flex flex-col gap-4">
              <a
                href={STEAM_LOGIN_URL}
                className="steam-button w-full py-4 px-8 rounded-lg flex items-center justify-center gap-4 group"
              >
                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                  <svg
                    className="w-6 h-6 text-white group-hover:scale-110 transition-transform duration-300"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z" />
                  </svg>
                </div>
                <span className="font-headline-md text-headline-md text-white whitespace-nowrap">
                  Iniciar sesión con Steam
                </span>
              </a>

              {/* TODO: conectar con Google OAuth en el backend */}
              <button
                type="button"
                className="google-button w-full py-4 px-8 rounded-lg flex items-center justify-center gap-4 group border border-black/10"
              >
                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                  <svg
                    className="w-5 h-5 group-hover:scale-110 transition-transform duration-300"
                    viewBox="0 0 48 48"
                  >
                    <path
                      fill="#FFC107"
                      d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20c11.045 0 20-8.955 20-20 0-1.341-.138-2.65-.389-3.917z"
                    />
                    <path
                      fill="#FF3D00"
                      d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4c-7.682 0-14.344 4.337-17.694 10.691z"
                    />
                    <path
                      fill="#4CAF50"
                      d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
                    />
                    <path
                      fill="#1976D2"
                      d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
                    />
                  </svg>
                </div>
                <span className="font-headline-md text-headline-md text-[#1f1f1f] whitespace-nowrap">
                  Continuar con Google
                </span>
              </button>
            </div>
            <div className="mt-12 flex flex-col gap-2">
              <p className="font-body-sm text-body-sm text-on-surface-variant/50">
                Al continuar, aceptas nuestros términos de servicio.
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant/40">
                Vender items del inventario de Dota 2 requiere iniciar sesión con Steam.
              </p>
            </div>
          </div>
          <div className="absolute inset-0 z-[-2] flex items-center justify-center opacity-[0.02] pointer-events-none select-none">
            <span className="font-headline-xl text-[20rem] font-black tracking-tighter">
              PS
            </span>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
