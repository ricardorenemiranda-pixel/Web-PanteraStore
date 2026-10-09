"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ImagePlaceholder from "@/components/ImagePlaceholder";
import {
  AdminItem,
  ItemFormInput,
  PricingConfig,
  createItem,
  fetchPricingConfig,
  fetchSteamQuote,
  syncItemPrice,
  updateItem,
  updateItemMarkup,
  updateItemPrice,
} from "@/lib/adminApi";
import { ALL_HERO_NAMES, CATEGORY_LABEL, ItemCategory, RARITY_LABEL, Rarity } from "@/lib/mock-data";
import { formatPEN } from "@/lib/currency";

const ALL_CATEGORIES = Object.keys(CATEGORY_LABEL) as ItemCategory[];
const ALL_RARITIES = Object.keys(RARITY_LABEL) as Rarity[];

interface Props {
  /** null = creando un item nuevo. */
  item: AdminItem | null;
}

const EMPTY_FORM: ItemFormInput = {
  name: "",
  hero: "",
  category: "hero",
  rarity: "mythical",
  description: "",
  imageUrl: "",
  steamMarketHashName: "",
  marketPrice: 0,
  stock: 0,
  published: true,
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-label-caps text-[10px] text-secondary uppercase tracking-wider pb-2 border-b border-on-surface/5">
      {children}
    </h3>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">{label}</label>
      {children}
    </div>
  );
}

export default function ItemFormPage({ item }: Props) {
  const router = useRouter();

  const [form, setForm] = useState<ItemFormInput>(EMPTY_FORM);
  const [priceInput, setPriceInput] = useState("");
  const [markupInput, setMarkupInput] = useState("");
  const [marketPrice, setMarketPrice] = useState(0);
  const [saving, setSaving] = useState(false);
  const [syncingPrice, setSyncingPrice] = useState(false);
  const [error, setError] = useState("");
  const [pricingConfig, setPricingConfig] = useState<PricingConfig | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: boolean; steamMarketHashName?: boolean }>({});

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name,
        hero: item.hero ?? "",
        category: item.category,
        rarity: item.rarity,
        description: item.description ?? "",
        imageUrl: item.imageUrl ?? "",
        steamMarketHashName: item.steamMarketHashName ?? "",
        marketPrice: item.marketPrice,
        stock: item.stock,
        published: item.published,
      });
      setPriceInput(item.manualPriceOverride?.toString() ?? "");
      setMarkupInput(item.markupPercentOverride?.toString() ?? "");
      setMarketPrice(item.marketPrice);
    } else {
      setForm(EMPTY_FORM);
      setPriceInput("");
      setMarkupInput("");
      setMarketPrice(0);
    }
    setFieldErrors({});
  }, [item]);

  useEffect(() => {
    fetchPricingConfig()
      .then(setPricingConfig)
      .catch(() => setPricingConfig(null));
  }, []);

  // Mismo criterio que el backend: el markup de la rareza manda; si no tiene, el global.
  const rarityMarkup = pricingConfig
    ? ((pricingConfig.rarityMarkups as Record<string, number | null>)[form.rarity] ??
      pricingConfig.globalMarkupPercent)
    : null;
  const recommendedPrice =
    rarityMarkup !== null && marketPrice > 0 ? marketPrice * (1 + rarityMarkup / 100) : null;

  const computedFinalPrice = (() => {
    if (priceInput.trim() !== "") {
      const manual = Number(priceInput);
      return Number.isNaN(manual) ? null : manual;
    }
    if (markupInput.trim() !== "") {
      const percent = Number(markupInput);
      return Number.isNaN(percent) ? null : marketPrice * (1 + percent / 100);
    }
    return item ? item.price : null;
  })();

  async function handleConsultPrice() {
    setSyncingPrice(true);
    setError("");
    try {
      if (item) {
        const updated = await syncItemPrice(item.id);
        setMarketPrice(updated.marketPrice);
      } else {
        const { marketPrice: quoted } = await fetchSteamQuote((form.steamMarketHashName ?? "").trim());
        if (quoted === null) {
          setError("Steam Market no devolvió precio para ese nombre. Revisa que sea exacto.");
          return;
        }
        setMarketPrice(quoted);
        setForm((prev) => ({ ...prev, marketPrice: quoted }));
      }
    } catch {
      setError("No se pudo consultar el precio en Steam Market.");
    } finally {
      setSyncingPrice(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const errors: typeof fieldErrors = {};
    if (!form.name.trim()) errors.name = true;
    if (!form.steamMarketHashName?.trim()) errors.steamMarketHashName = true;

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("Completa los campos obligatorios marcados en rojo.");
      return;
    }
    setFieldErrors({});

    const price = priceInput.trim() === "" ? null : Number(priceInput);
    const markup = markupInput.trim() === "" ? null : Number(markupInput);
    if (price !== null && Number.isNaN(price)) {
      setError("El precio final no es un número válido.");
      return;
    }
    if (markup !== null && Number.isNaN(markup)) {
      setError("El markup no es un número válido.");
      return;
    }

    setSaving(true);
    setError("");
    const payload = {
      name: form.name.trim(),
      hero: form.hero?.trim() || undefined,
      category: form.category,
      rarity: form.rarity,
      description: form.description?.trim() || undefined,
      imageUrl: form.imageUrl?.trim() || undefined,
      steamMarketHashName: (form.steamMarketHashName ?? "").trim(),
      stock: form.stock,
    };
    try {
      // marketPrice solo lo acepta el alta (POST) — la edición (PATCH) lo
      // rechaza con 400 si viene en el body, se actualiza aparte vía
      // "Consultar Steam" / updateItemPrice.
      let saved = item
        ? await updateItem(item.id, { ...payload, published: form.published })
        : await createItem({ ...payload, marketPrice: form.marketPrice });
      if (item || price !== null) saved = await updateItemPrice(saved.id, price);
      if (item || markup !== null) saved = await updateItemMarkup(saved.id, markup);
      router.push("/admin");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "No se pudo guardar el item.");
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-on-background font-body-md">
      <header className="fixed top-0 left-0 w-full z-50 flex items-center gap-4 px-margin-mobile md:px-margin-desktop h-16 bg-surface/80 backdrop-blur-xl border-b border-on-surface/10">
        <Link
          href="/admin"
          className="flex items-center gap-1 font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Volver al catálogo
        </Link>
      </header>

      <main className="pt-16">
        <div className="max-w-[1400px] mx-auto px-margin-mobile md:px-margin-desktop py-12">
          <div className="mb-8">
            <h1 className="font-headline-lg text-headline-lg text-on-surface">
              {item ? item.name : "Nuevo item"}
            </h1>
            {item && (
              <p className="font-label-caps text-[10px] text-on-surface-variant uppercase mt-1">
                Código {item.referenceCode}
              </p>
            )}
          </div>

          {error && (
            <div className="mb-6 bg-error/10 border border-error/20 text-error px-4 py-3 text-body-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-3 gap-gutter items-start">
            {/* Columna principal: información del item */}
            <div className="xl:col-span-2 flex flex-col gap-10">
              <div className="flex flex-col gap-4">
                <SectionLabel>Información general</SectionLabel>
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex flex-col gap-2 shrink-0">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                      Imagen
                    </span>
                    <div className="w-48 aspect-[4/3] bg-surface-container-highest border border-on-surface/10 p-3 flex items-center justify-center">
                      {form.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={form.imageUrl} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <ImagePlaceholder label="" icon="image" className="w-full h-full" />
                      )}
                    </div>
                    <input
                      type="url"
                      className="w-48 bg-surface-container border border-on-surface/10 text-on-surface font-body-sm py-2 px-3"
                      value={form.imageUrl}
                      onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                    />
                  </div>

                  <div className="flex-1 flex flex-col gap-4">
                    <Field label="Nombre">
                      <input
                        className={`bg-surface-container border text-on-surface font-body-sm py-2 px-3 ${
                          fieldErrors.name ? "border-error field-error" : "border-on-surface/10"
                        }`}
                        value={form.name}
                        onChange={(e) => {
                          setForm({ ...form, name: e.target.value });
                          if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
                        }}
                      />
                      {fieldErrors.name && (
                        <span className="font-body-sm text-error">Este campo es obligatorio.</span>
                      )}
                    </Field>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Field label="Héroe (opcional)">
                        <select
                          className="bg-surface-container border border-on-surface/10 text-on-surface font-body-sm py-2 px-3"
                          value={form.hero}
                          onChange={(e) => setForm({ ...form, hero: e.target.value })}
                        >
                          <option value="">Sin héroe</option>
                          {ALL_HERO_NAMES.map((hero) => (
                            <option key={hero} value={hero}>
                              {hero}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Categoría">
                        <select
                          className="bg-surface-container border border-on-surface/10 text-on-surface font-body-sm py-2 px-3"
                          value={form.category}
                          onChange={(e) => setForm({ ...form, category: e.target.value as ItemCategory })}
                        >
                          {ALL_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {CATEGORY_LABEL[c]}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Rareza">
                        <select
                          className="bg-surface-container border border-on-surface/10 text-on-surface font-body-sm py-2 px-3"
                          value={form.rarity}
                          onChange={(e) => setForm({ ...form, rarity: e.target.value as Rarity })}
                        >
                          {ALL_RARITIES.map((r) => (
                            <option key={r} value={r}>
                              {RARITY_LABEL[r]}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  </div>
                </div>

                <Field label="Descripción (opcional)">
                  <textarea
                    rows={3}
                    className="bg-surface-container border border-on-surface/10 text-on-surface font-body-sm py-2 px-3 resize-y"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </Field>
              </div>

              <div className="flex flex-col gap-4">
                <SectionLabel>Steam Market</SectionLabel>
                <Field label="Nombre exacto en Steam Market">
                  <input
                    className={`bg-surface-container border text-on-surface font-body-sm py-2 px-3 ${
                      fieldErrors.steamMarketHashName ? "border-error field-error" : "border-on-surface/10"
                    }`}
                    value={form.steamMarketHashName}
                    onChange={(e) => {
                      setForm({ ...form, steamMarketHashName: e.target.value });
                      if (fieldErrors.steamMarketHashName)
                        setFieldErrors((prev) => ({ ...prev, steamMarketHashName: undefined }));
                    }}
                  />
                  {fieldErrors.steamMarketHashName && (
                    <span className="font-body-sm text-error">Este campo es obligatorio.</span>
                  )}
                </Field>
                <p className="font-body-sm text-on-surface-variant">
                  Tiene que ser el nombre exacto tal como aparece en Steam Market — se usa para
                  &quot;Consultar Steam&quot; y la sincronización automática de precios.
                </p>
              </div>
            </div>

            {/* Barra lateral: precio/stock, visibilidad y acciones */}
            <div className="flex flex-col gap-gutter xl:sticky xl:top-20">
              <div className="bg-surface-container border border-on-surface/5 p-5 flex flex-col gap-4">
                <SectionLabel>Precio y stock</SectionLabel>

                <div className="flex items-center justify-between bg-surface border border-on-surface/5 px-4 py-3">
                  <div>
                    <span className="font-label-caps text-[10px] text-on-surface-variant uppercase block">
                      Precio Steam
                    </span>
                    <span className="font-price-display text-price-display text-on-surface">
                      {formatPEN(marketPrice)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleConsultPrice}
                    disabled={syncingPrice || !form.steamMarketHashName?.trim()}
                    className="flex items-center gap-1 text-secondary hover:underline font-label-caps text-[10px] disabled:opacity-30"
                  >
                    <span className={`material-symbols-outlined text-sm ${syncingPrice ? "animate-spin" : ""}`}>
                      sync
                    </span>
                    {syncingPrice ? "..." : "Consultar"}
                  </button>
                </div>

                {rarityMarkup !== null && (
                  <div className="flex items-center justify-between gap-3 bg-primary/10 border border-primary/20 px-4 py-3">
                    <div>
                      <span className="font-label-caps text-[10px] text-primary uppercase block">
                        Recomendado · {RARITY_LABEL[form.rarity]} +{rarityMarkup}%
                      </span>
                      <span className="font-price-display text-price-display text-on-surface">
                        {recommendedPrice !== null ? formatPEN(recommendedPrice) : "Consulta Steam primero"}
                      </span>
                    </div>
                    {recommendedPrice !== null && (
                      <button
                        type="button"
                        onClick={() => {
                          setPriceInput(recommendedPrice.toFixed(2));
                          setMarkupInput("");
                        }}
                        className="font-label-caps text-[10px] text-primary hover:underline"
                      >
                        Usar
                      </button>
                    )}
                  </div>
                )}

                <Field label="Precio final (S/)">
                  <input
                    type="number"
                    step="0.1"
                    className="bg-surface border border-on-surface/10 text-on-surface font-body-sm py-2 px-3"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    onFocus={(e) => e.target.select()}
                  />
                </Field>
                <Field label="Markup propio (%)">
                  <input
                    type="number"
                    step="0.1"
                    className="bg-surface border border-on-surface/10 text-on-surface font-body-sm py-2 px-3"
                    value={markupInput}
                    onChange={(e) => setMarkupInput(e.target.value)}
                    onFocus={(e) => e.target.select()}
                  />
                </Field>

                {computedFinalPrice !== null && (
                  <div className="flex items-center gap-2 bg-surface border border-on-surface/5 px-4 py-3">
                    <span className="font-body-sm text-on-surface-variant">{formatPEN(marketPrice)}</span>
                    <span className="material-symbols-outlined text-sm text-on-surface-variant">
                      arrow_forward
                    </span>
                    <span className="font-price-display text-price-display text-secondary">
                      {formatPEN(computedFinalPrice)}
                    </span>
                    <span className="font-label-caps text-[9px] text-on-surface-variant uppercase ml-auto">
                      {priceInput.trim() !== ""
                        ? "precio manual"
                        : markupInput.trim() !== ""
                          ? "markup propio"
                          : "sin cambios"}
                    </span>
                  </div>
                )}

                <Field label="Stock">
                  <input
                    type="number"
                    min={0}
                    className="bg-surface border border-on-surface/10 text-on-surface font-body-sm py-2 px-3"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                    onFocus={(e) => e.target.select()}
                  />
                </Field>
              </div>

              {item && (
                <div className="bg-surface-container border border-on-surface/5 p-5 flex flex-col gap-3">
                  <SectionLabel>Visibilidad</SectionLabel>
                  <label className="flex items-center gap-2 font-body-sm text-on-surface">
                    <input
                      type="checkbox"
                      checked={form.published}
                      onChange={(e) => setForm({ ...form, published: e.target.checked })}
                    />
                    Publicado (visible en el catálogo público)
                  </label>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-primary text-on-primary px-6 py-3 font-label-caps text-label-caps hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
                <Link
                  href="/admin"
                  className="w-full text-center px-4 py-2 font-label-caps text-label-caps text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  Cancelar
                </Link>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
