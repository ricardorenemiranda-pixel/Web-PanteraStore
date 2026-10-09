"use client";

import ImagePlaceholder from "@/components/ImagePlaceholder";
import { AdminItem } from "@/lib/adminApi";
import { CATEGORY_LABEL, RARITY_BADGE_CLASS, RARITY_LABEL, type Rarity } from "@/lib/mock-data";
import { formatPEN } from "@/lib/currency";

const RARITY_BORDER_CLASS: Record<Rarity, string> = {
  common: "border-l-rarity-common",
  uncommon: "border-l-rarity-uncommon",
  rare: "border-l-rarity-rare",
  mythical: "border-l-rarity-mythical",
  legendary: "border-l-rarity-legendary",
  immortal: "border-l-rarity-immortal",
  arcana: "border-l-rarity-arcana",
  ancient: "border-l-rarity-ancient",
};

interface Props {
  item: AdminItem;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

/** Tarjeta de solo lectura — clic en cualquier parte navega a la página de edición del item. */
export default function AdminItemCard({ item, deleting, onEdit, onDelete }: Props) {
  const available = item.stock > 0;

  return (
    <article
      className={`group relative bg-surface-container border border-on-surface/5 border-l-2 ${RARITY_BORDER_CLASS[item.rarity]} overflow-hidden flex flex-col cursor-pointer hover:border-on-surface/10 transition-colors`}
      onClick={onEdit}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onEdit();
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        disabled={deleting}
        aria-label="Eliminar item"
        className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center bg-background/70 text-on-surface-variant opacity-0 group-hover:opacity-100 hover:text-error transition-all disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-base">{deleting ? "hourglass_empty" : "delete"}</span>
      </button>

      <div className="relative aspect-[4/3] bg-surface-container-highest flex items-center justify-center">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-contain p-3"
          />
        ) : (
          <ImagePlaceholder label="" icon="category" className="w-full h-full" />
        )}
        {!available && (
          <span className="absolute bottom-2 left-2 px-2 py-0.5 font-label-caps text-[9px] uppercase bg-background/80 text-error">
            Agotado
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-body-md text-on-surface font-semibold leading-snug">{item.name}</h3>
          <span
            className={`shrink-0 px-2 py-0.5 font-label-caps text-[9px] uppercase whitespace-nowrap ${RARITY_BADGE_CLASS[item.rarity]}`}
          >
            {RARITY_LABEL[item.rarity]}
          </span>
        </div>
        <p className="text-[11px] text-on-surface-variant">
          {item.hero ?? CATEGORY_LABEL[item.category]} · #{item.referenceCode}
          {available && ` · ${item.stock} disp.`}
          {!item.published && " · Borrador"}
          {item.markupPercentOverride !== null && " · Markup propio"}
        </p>
        <span className="font-price-display text-price-display text-on-surface">
          {formatPEN(item.price)}
        </span>
      </div>
    </article>
  );
}
