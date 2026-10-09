import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";

const WHATSAPP_NUMBER = "51900000000"; // TODO: reemplazar por el número real de la empresa

export default function ContactoPage() {
  return (
    <>
      <Header />
      <main className="pt-24 pb-24 lg:pb-20">
        <section className="px-margin-mobile md:px-margin-desktop pt-8 pb-16 max-w-3xl">
          <h1 className="font-headline-xl text-headline-lg-mobile md:text-headline-xl text-on-surface">
            Contacto y soporte
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-4">
            Toda consulta, compra o venta se coordina directamente por WhatsApp — es el único
            canal que atendemos en tiempo real.
          </p>
        </section>

        <section className="px-margin-mobile md:px-margin-desktop max-w-3xl mx-auto flex flex-col gap-4">
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noreferrer"
            className="surface-card p-8 flex items-center justify-between gap-6 group"
          >
            <div className="flex items-center gap-5">
              <span className="icon-tile text-[#25D366] bg-[#25D366]/10">
                <span className="material-symbols-outlined text-[#25D366] text-2xl">chat</span>
              </span>
              <div>
                <h2 className="font-headline-md text-headline-sm text-on-surface mb-1">WhatsApp</h2>
                <p className="font-body-sm text-on-surface-variant">Compras, ventas, dudas sobre un item o tu pedido.</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant group-hover:translate-x-1 transition-transform">
              arrow_forward
            </span>
          </a>

          <a
            href="https://steamcommunity.com/market/"
            target="_blank"
            rel="noreferrer"
            className="surface-card p-8 flex items-center justify-between gap-6 group"
          >
            <div className="flex items-center gap-5">
              <span className="icon-tile text-primary">
                <span className="material-symbols-outlined text-primary text-2xl">verified_user</span>
              </span>
              <div>
                <h2 className="font-headline-md text-headline-sm text-on-surface mb-1">Steam Community Market</h2>
                <p className="font-body-sm text-on-surface-variant">La referencia de precio que usamos para cada item — puedes verificarla tú mismo.</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant group-hover:translate-x-1 transition-transform">
              open_in_new
            </span>
          </a>

          <p className="font-body-sm text-on-surface-variant mt-4">
            ¿Primera vez comprando o vendiendo? Revisa{" "}
            <Link href="/como-funciona" className="text-primary underline">
              cómo funciona
            </Link>{" "}
            antes de escribirnos — puede que ya esté respondido ahí.
          </p>
        </section>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
