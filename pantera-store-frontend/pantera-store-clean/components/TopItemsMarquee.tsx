import Link from "next/link";
import ImagePlaceholder from "@/components/ImagePlaceholder";
import { RARITY_LABEL, RARITY_DOT_CLASS, CATEGORY_LABEL } from "@/lib/mock-data";
import { formatPEN } from "@/lib/currency";
import type { CatalogItem } from "@/lib/catalogApi";

function itemSubtitle(item: CatalogItem): string {
  return item.hero ?? CATEGORY_LABEL[item.category];
}

// Fila única, más lenta que el muro de héroes (hay más que leer: nombre
// y precio) — misma mecánica de loop infinito duplicando la lista.
const ROW_DURATION = 70;

export default function TopItemsMarquee({ items }: { items: CatalogItem[] }) {
  if (items.length === 0) return null;

  return (
    <div
      className="marquee-row"
      style={{
        maskImage: "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
      }}
    >
      <div className="marquee-track" style={{ animationDuration: `${ROW_DURATION}s` }}>
        {[...items, ...items].map((item, i) => (
          <Link key={`${item.id}-${i}`} href={`/catalogo/${item.id}`} className="item-marquee-cell group">
            <div className="item-marquee-cell-image">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt={item.name} loading="lazy" decoding="async" />
              ) : (
                <ImagePlaceholder label={item.name} className="w-full h-full" />
              )}
              <span className={`item-marquee-cell-dot ${RARITY_DOT_CLASS[item.rarity]}`} />
            </div>
            <div className="item-marquee-cell-info">
              <p className="font-body-sm text-[11px] text-on-surface-variant truncate">
                {RARITY_LABEL[item.rarity]} · {itemSubtitle(item)}
              </p>
              <h3 className="font-body-md text-body-sm text-on-surface truncate mt-0.5 group-hover:text-primary transition-colors">
                {item.name}
              </h3>
              <p className="figure-nums text-on-surface font-semibold text-price-display mt-1">
                {formatPEN(item.price)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
