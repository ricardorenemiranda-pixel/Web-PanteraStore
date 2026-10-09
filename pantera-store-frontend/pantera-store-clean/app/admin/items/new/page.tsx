"use client";

import Link from "next/link";
import ItemFormPage from "@/components/ItemFormPage";
import { useAuth } from "@/lib/AuthContext";

export default function NewItemPage() {
  const { user, loading: userLoading } = useAuth();
  const isAdmin = user?.role === "admin";

  if (userLoading) {
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

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-center px-4">
        <div className="glass-panel p-10">
          <p className="text-on-surface-variant">
            Tu cuenta ({user.displayName}) no tiene permisos de administrador.
          </p>
        </div>
      </div>
    );
  }

  return <ItemFormPage item={null} />;
}
