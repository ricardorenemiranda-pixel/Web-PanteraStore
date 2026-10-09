"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ItemFormPage from "@/components/ItemFormPage";
import { useAuth } from "@/lib/AuthContext";
import { AdminItem, fetchAllItemsAdmin } from "@/lib/adminApi";

export default function EditItemPage() {
  const { user, loading: userLoading } = useAuth();
  const params = useParams<{ id: string }>();
  const isAdmin = user?.role === "admin";

  const [item, setItem] = useState<AdminItem | null>(null);
  const [loadingItem, setLoadingItem] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const itemId = params?.id ?? "";

  useEffect(() => {
    if (!isAdmin) return;
    fetchAllItemsAdmin()
      .then((items) => {
        const found = items.find((i) => i.id === itemId);
        if (!found) {
          setNotFound(true);
          return;
        }
        setItem(found);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoadingItem(false));
  }, [isAdmin, itemId]);

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

  if (loadingItem) {
    return <div className="min-h-screen bg-background" />;
  }

  if (notFound || !item) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-center px-4">
        <div className="glass-panel p-10">
          <p className="text-on-surface-variant mb-4">No encontramos ese item.</p>
          <Link href="/admin" className="text-primary underline">
            Volver al catálogo
          </Link>
        </div>
      </div>
    );
  }

  return <ItemFormPage item={item} />;
}
