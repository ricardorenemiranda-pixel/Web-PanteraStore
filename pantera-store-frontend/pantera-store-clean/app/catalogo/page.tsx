"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import ImagePlaceholder from "@/components/ImagePlaceholder";
import {
  RARITY_CLASS,
  RARITY_LABEL,
  RARITY_BADGE_CLASS,
  Rarity,
  ALL_HERO_NAMES,
  HERO_ATTRIBUTE,
  HERO_ICON,
  ATTRIBUTE_LABEL,
  ATTRIBUTE_ICON,
  HeroAttribute,
  ItemCategory,
  CATEGORY_LABEL,
} from "@/lib/mock-data";
import { formatPEN } from "@/lib/currency";
import { fetchCatalogItems, type CatalogItem } from "@/lib/catalogApi";

const FILTERABLE_RARITIES: Rarity[] = ["mythical", "legendary", "immortal", "arcana"];
const ALL_ATTRIBUTES = Object.keys(ATTRIBUTE_LABEL) as HeroAttribute[];
const ALL_CATEGORIES = Object.keys(CATEGORY_LABEL) as ItemCategory[];
const HERO_PANEL_CLOSE_DELAY = 200;
const PRICE_MAX = 2000;

type SortOption = "recomendados" | "mayor" | "menor" | "nuevos";

function itemSubtitle(item: CatalogItem): string {
  return item.hero ?? CATEGORY_LABEL[item.category];
}

function availabilityBadge(item: CatalogItem): string {
  if (item.stock > 0) return "En venta";
  if (item.pendingHolds.length > 0) return "Disponible pronto";
  return "Agotado";
}

export default function CatalogoPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRarities, setSelectedRarities] = useState<Rarity[]>([]);
  const [selectedHero, setSelectedHero] = useState<string | null>(null);
  const [selectedAttributes, setSelectedAttributes] = useState<HeroAttribute[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<ItemCategory[]>([]);
  const [heroSearch, setHeroSearch] = useState("");
  const [heroFilterOpen, setHeroFilterOpen] = useState(false);
  const [heroPanelRect, setHeroPanelRect] = useState({ top: 0, left: 0, width: 460 });
  const [maxPrice, setMaxPrice] = useState(PRICE_MAX);
  const [sort, setSort] = useState<SortOption>("recomendados");

  useEffect(() => {
    fetchCatalogItems()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  const heroTriggerRef = useRef<HTMLDivElement>(null);
  const heroCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openHeroPanel() {
    if (heroCloseTimer.current) {
      clearTimeout(heroCloseTimer.current);
      heroCloseTimer.current = null;
    }
    const rect = heroTriggerRef.current?.getBoundingClientRect();
    if (rect) {
      setHeroPanelRect({ top: rect.bottom, left: rect.left, width: Math.max(rect.width, 460) });
    }
    setHeroFilterOpen(true);
  }

  function scheduleCloseHeroPanel() {
    heroCloseTimer.current = setTimeout(() => setHeroFilterOpen(false), HERO_PANEL_CLOSE_DELAY);
  }

  function toggleRarity(rarity: Rarity) {
    setSelectedRarities((prev) =>
      prev.includes(rarity) ? prev.filter((r) => r !== rarity) : [...prev, rarity]
    );
  }

  function toggleAttribute(attribute: HeroAttribute) {
    setSelectedAttributes((prev) =>
      prev.includes(attribute) ? prev.filter((a) => a !== attribute) : [...prev, attribute]
    );
  }

  function toggleCategory(category: ItemCategory) {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  }

  const visibleHeroes = useMemo(() => {
    return ALL_HERO_NAMES.filter((hero) => {
      if (selectedAttributes.length > 0 && !selectedAttributes.includes(HERO_ATTRIBUTE[hero])) {
        return false;
      }
      if (heroSearch && !hero.toLowerCase().includes(heroSearch.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [selectedAttributes, heroSearch]);

  const filteredItems = useMemo(() => {
    let result = items.filter((item) => {
      if (selectedCategories.length > 0 && !selectedCategories.includes(item.category)) {
        return false;
      }
      if (selectedRarities.length > 0 && !selectedRarities.includes(item.rarity)) {
        return false;
      }
      if (selectedHero && item.hero !== selectedHero) {
        return false;
      }
      if (
        selectedAttributes.length > 0 &&
        !selectedAttributes.includes(HERO_ATTRIBUTE[item.hero ?? ""])
      ) {
        return false;
      }
      if (maxPrice < PRICE_MAX && item.price > maxPrice) {
        return false;
      }
      return true;
    });

    if (sort === "mayor") {
      result = [...result].sort((a, b) => b.price - a.price);
    } else if (sort === "menor") {
      result = [...result].sort((a, b) => a.price - b.price);
    } else if (sort === "nuevos") {
      result = [...result].sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
    }

    return result;
  }, [items, selectedCategories, selectedRarities, selectedHero, selectedAttributes, maxPrice, sort]);

  return (
    <>
      <Header />
      <div className="bg-background text-on-surface font-body-md min-h-screen flex flex-col">
        <main className="pt-24 pb-24 lg:pb-20 flex-1 px-margin-mobile md:px-margin-desktop flex gap-gutter">
          {/* Filtros laterales */}
          <aside className="hidden lg:flex flex-col w-64 gap-8 sticky top-24 h-[calc(100vh-120px)] overflow-y-auto pr-4">
            <div
              ref={heroTriggerRef}
              onMouseEnter={openHeroPanel}
              onMouseLeave={scheduleCloseHeroPanel}
            >
              <div className="w-full flex items-center justify-between mb-1 cursor-default">
                <h3 className="font-label-caps text-label-caps text-primary uppercase tracking-widest">
                  Héroe{selectedHero ? `: ${selectedHero}` : ""}
                </h3>
                <span
                  className={`material-symbols-outlined text-[20px] text-on-surface-variant transition-transform ${
                    heroFilterOpen ? "rotate-180 text-primary" : ""
                  }`}
                >
                  expand_more
                </span>
              </div>

              {heroFilterOpen &&
                createPortal(
                  <div
                    onMouseEnter={openHeroPanel}
                    onMouseLeave={scheduleCloseHeroPanel}
                    style={{
                      position: "fixed",
                      top: heroPanelRect.top,
                      left: heroPanelRect.left,
                      width: heroPanelRect.width,
                    }}
                    className="z-[100] flex flex-col gap-3 bg-surface-container border border-outline-variant rounded-lg shadow-2xl p-4"
                  >
                    <div className="grid grid-cols-4 gap-2">
                      {ALL_ATTRIBUTES.map((attribute) => (
                        <button
                          key={attribute}
                          type="button"
                          title={ATTRIBUTE_LABEL[attribute]}
                          onClick={() => toggleAttribute(attribute)}
                          className={`h-8 flex items-center justify-center overflow-hidden rounded border transition-colors ${
                            selectedAttributes.includes(attribute)
                              ? "border-primary bg-primary/10"
                              : "border-outline-variant hover:border-primary/40"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={ATTRIBUTE_ICON[attribute]}
                            alt={ATTRIBUTE_LABEL[attribute]}
                            className="w-5 h-5"
                          />
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant/60 pointer-events-none">
                        search
                      </span>
                      <input
                        type="text"
                        value={heroSearch}
                        onChange={(e) => setHeroSearch(e.target.value)}
                        placeholder="Buscar héroe..."
                        className="w-full bg-surface-container border border-outline-variant rounded pl-8 pr-2 py-1.5 text-sm focus:border-primary outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-5 gap-2 max-h-[60vh] overflow-y-auto pr-1">
                      <button
                        onClick={() => setSelectedHero(null)}
                        className={`flex flex-col items-center gap-1 p-1.5 rounded cursor-pointer transition-colors ${
                          selectedHero === null ? "bg-primary/5" : "hover:bg-white/5"
                        }`}
                      >
                        <div
                          className={`w-full aspect-square bg-surface-container-lowest rounded-sm overflow-hidden flex items-center justify-center border-2 ${
                            selectedHero === null ? "border-primary" : "border-transparent"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[22px] opacity-60">
                            apps
                          </span>
                        </div>
                        <span className="text-[10px] text-center leading-tight">Todos</span>
                      </button>
                      {visibleHeroes.map((hero) => (
                        <button
                          key={hero}
                          onClick={() => setSelectedHero(hero)}
                          className={`flex flex-col items-center gap-1 p-1.5 rounded cursor-pointer transition-colors ${
                            selectedHero === hero ? "bg-primary/5" : "hover:bg-white/5"
                          }`}
                        >
                          <div
                            className={`w-full aspect-square bg-surface-container-lowest rounded-sm overflow-hidden border-2 ${
                              selectedHero === hero ? "border-primary" : "border-transparent"
                            }`}
                          >
                            {HERO_ICON[hero] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={HERO_ICON[hero]}
                                alt={hero}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ImagePlaceholder label="" icon="person" className="w-full h-full" />
                            )}
                          </div>
                          <span className="text-[10px] text-center leading-tight truncate w-full">
                            {hero}
                          </span>
                        </button>
                      ))}
                      {visibleHeroes.length === 0 && (
                        <p className="col-span-5 text-body-sm text-on-surface-variant/50 px-2">
                          Sin resultados.
                        </p>
                      )}
                    </div>
                  </div>,
                  document.body
                )}
            </div>
            <div>
              <h3 className="font-label-caps text-label-caps text-primary mb-4 uppercase tracking-widest">
                Categoría
              </h3>
              <div className="flex flex-col gap-3">
                {ALL_CATEGORIES.map((category) => (
                  <label key={category} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      className="rounded-sm bg-surface-container border-outline-variant text-primary focus:ring-primary"
                      type="checkbox"
                      checked={selectedCategories.includes(category)}
                      onChange={() => toggleCategory(category)}
                    />
                    <span className="text-body-sm text-on-surface-variant group-hover:text-on-surface transition-colors">
                      {CATEGORY_LABEL[category]}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-label-caps text-label-caps text-primary mb-4 uppercase tracking-widest">
                Rareza
              </h3>
              <div className="flex flex-col gap-3">
                {FILTERABLE_RARITIES.map((rarity) => (
                  <label key={rarity} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      className="rounded-sm bg-surface-container border-outline-variant text-primary focus:ring-primary"
                      type="checkbox"
                      checked={selectedRarities.includes(rarity)}
                      onChange={() => toggleRarity(rarity)}
                    />
                    <span className="text-body-sm text-on-surface-variant group-hover:text-on-surface transition-colors flex items-center gap-2">
                      {RARITY_LABEL[rarity]}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-label-caps text-label-caps text-primary mb-4 uppercase tracking-widest">
                Rango de Precio
              </h3>
              <div className="space-y-4">
                <input
                  className="w-full accent-primary bg-surface-container rounded-lg appearance-none h-1.5 cursor-pointer"
                  type="range"
                  min={0}
                  max={PRICE_MAX}
                  step={10}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                />
                <div className="flex justify-between text-label-caps text-on-surface-variant">
                  <span>S/ 0</span>
                  <span>{maxPrice >= PRICE_MAX ? "S/ 2,000+" : formatPEN(maxPrice)}</span>
                </div>
              </div>
            </div>
          </aside>

          {/* Grid de productos */}
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
              <h1 className="font-headline-lg text-headline-lg text-on-surface">
                Artefactos Disponibles
              </h1>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-label-caps text-on-surface-variant whitespace-nowrap">
                  Ordenar por:
                </span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOption)}
                  className="bg-surface-container border border-outline-variant rounded px-3 py-1.5 text-sm focus:border-primary outline-none flex-1 sm:flex-none"
                >
                  <option value="recomendados">Recomendados</option>
                  <option value="mayor">Precio: Mayor a menor</option>
                  <option value="menor">Precio: Menor a mayor</option>
                  <option value="nuevos">Nuevos Items</option>
                </select>
              </div>
            </div>

            {loading && (
              <p className="text-on-surface-variant text-body-sm mt-12 text-center">
                Cargando catálogo...
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/catalogo/${item.id}`}
                  className={`group flex flex-col bg-surface-container border border-white/5 hover:border-primary/30 transition-all ${RARITY_CLASS[item.rarity]} relative overflow-hidden ${
                    item.stock === 0 ? "opacity-60" : ""
                  }`}
                >
                  <div className="absolute top-2 right-2 z-10">
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter">
                      {availabilityBadge(item)}
                    </span>
                  </div>
                  <div className="aspect-square w-full bg-surface-container-lowest flex items-center justify-center p-4 relative">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
                    ) : (
                      <ImagePlaceholder label={item.name} className="w-full h-full" />
                    )}
                  </div>
                  <div className="p-4 flex flex-col gap-1">
                    <span className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest">
                      {itemSubtitle(item)}
                    </span>
                    <h4 className="font-body-md text-on-surface group-hover:text-primary transition-colors">
                      {item.name}
                    </h4>
                    <div className="flex justify-between items-end mt-4">
                      <span className={`px-2 py-0.5 text-[10px] font-bold ${RARITY_BADGE_CLASS[item.rarity]}`}>
                        {RARITY_LABEL[item.rarity]}
                      </span>
                      <span className="font-price-display text-price-display text-on-surface">
                        {formatPEN(item.price)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {!loading && filteredItems.length === 0 && (
              <p className="text-on-surface-variant text-body-sm mt-12 text-center">
                No hay items que coincidan con los filtros seleccionados.
              </p>
            )}
          </div>
        </main>
        <Footer />
        <BottomNav />
      </div>
    </>
  );
}
