interface ImagePlaceholderProps {
  /** Texto que describe qué imagen debería ir aquí, ej: "Imagen del item" */
  label?: string;
  /** Nombre del ícono de Material Symbols a mostrar, ej: "image", "person", "storefront" */
  icon?: string;
  /** Clases extra para controlar tamaño/aspecto/posición desde el componente padre */
  className?: string;
  /** Clase de rareza opcional para el borde inferior (ej: rarity-arcana, rarity-immortal) */
  rarityClass?: string;
}

/**
 * Bloque reemplazo mientras no hay una imagen real todavía.
 * Úsalo en lugar de <img> en cualquier lugar donde después se vaya a
 * subir una foto/render real del item, avatar, o banner.
 */
export default function ImagePlaceholder({
  label = "Imagen",
  icon = "image",
  className = "",
  rarityClass = "",
}: ImagePlaceholderProps) {
  return (
    <div
      className={`img-placeholder flex flex-col items-center justify-center gap-2 border border-dashed border-white/15 bg-surface-container-low text-on-surface-variant ${rarityClass} ${className}`}
    >
      <span className="material-symbols-outlined text-[32px] opacity-60">
        {icon}
      </span>
      <span className="font-label-caps text-label-caps text-center px-2 opacity-60">
        {label}
      </span>
    </div>
  );
}
