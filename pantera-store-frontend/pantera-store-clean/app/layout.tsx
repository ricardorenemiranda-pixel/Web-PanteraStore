import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import IntroSplash from "@/components/IntroSplash";
import ChatWidget from "@/components/ChatWidget";
import RoomNotifications from "@/components/RoomNotifications";

export const metadata: Metadata = {
  title: "PanteraStore | Compra y Venta de Items Dota 2",
  description:
    "Compra y vende tus items de Dota 2 al mejor precio, calculado en base al Mercado de Steam.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="text-on-surface font-body-md selection:bg-primary selection:text-on-primary">
        <IntroSplash />
        <AuthProvider>
          {children}
          <ChatWidget />
          <RoomNotifications />
        </AuthProvider>
      </body>
    </html>
  );
}
