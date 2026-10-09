import Link from "next/link";
import { ALL_HERO_NAMES, HERO_ICON, HERO_ATTRIBUTE, ATTRIBUTE_ICON, ATTRIBUTE_LABEL } from "@/lib/mock-data";

// Reparte el roster completo en filas — cada fila se anima sola, en
// direcciones alternadas, como una pared de fichas en movimiento
// perpetuo. Usa los mismos íconos que ya existían en el filtro de
// héroes del catálogo (autohospedados desde antes), no assets nuevos.
// Cada ícono lleva al catálogo ya filtrado por ese héroe.
const ROW_COUNT = 5;
const ROW_DURATIONS = [88, 104, 80, 98, 90]; // segundos — distintos por fila para que no se sientan sincronizadas

function splitIntoRows<T>(items: T[], rows: number): T[][] {
  const result: T[][] = Array.from({ length: rows }, () => []);
  items.forEach((item, i) => result[i % rows].push(item));
  return result;
}

export default function HeroMarquee() {
  const heroesWithIcon = ALL_HERO_NAMES.filter((hero) => HERO_ICON[hero]);
  const rows = splitIntoRows(heroesWithIcon, ROW_COUNT);

  return (
    <div
      className="flex flex-col gap-4"
      style={{
        maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
      }}
    >
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="marquee-row">
          <div
            className="marquee-track"
            style={{
              animationDuration: `${ROW_DURATIONS[rowIndex % ROW_DURATIONS.length]}s`,
              animationDirection: rowIndex % 2 === 1 ? "reverse" : "normal",
            }}
          >
            {[...row, ...row].map((hero, i) => {
              const attribute = HERO_ATTRIBUTE[hero];
              return (
                <Link
                  key={`${hero}-${i}`}
                  href={`/catalogo?hero=${encodeURIComponent(hero)}`}
                  className="marquee-cell group"
                  title={`Ver items de ${hero}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={HERO_ICON[hero]} alt={hero} loading="lazy" decoding="async" className="marquee-cell-img" />
                  <span className="marquee-cell-label">
                    {attribute && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ATTRIBUTE_ICON[attribute]}
                        alt={ATTRIBUTE_LABEL[attribute]}
                        loading="lazy"
                        className="marquee-cell-attribute-icon"
                      />
                    )}
                    {hero}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
