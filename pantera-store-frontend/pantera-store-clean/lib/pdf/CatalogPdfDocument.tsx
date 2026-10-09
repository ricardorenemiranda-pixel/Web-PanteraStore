import { Document, Page, View, Text, Image, StyleSheet, Svg, Line, Polygon, Rect } from "@react-pdf/renderer";
import type { ItemCategory, Rarity } from "@/lib/mock-data";
import { CATEGORY_LABEL, RARITY_LABEL } from "@/lib/mock-data";

// Colores de PanteraStore (ver tailwind.config.ts) — el PDF usa la misma
// paleta morada que la web, no la de ningún otro proyecto.
const BACKGROUND = "#14101F";
const SURFACE = "#1C1630";
const SURFACE_HIGH = "#2B2248";
const IMAGE_BG = "#1C1630";
const PRICE_BAR = "#1C1630";
const ON_SURFACE = "#F1EDFA";
const ON_SURFACE_VARIANT = "#A99BC7";
const PRIMARY = "#B18AE8";
const PRIMARY_CONTAINER = "#3A2F5C";
const SECONDARY = "#C9A6E0";
const BORDER = "#2E2650";

// Colores de facción de Dota 2 — tinte muy sutil en esquinas opuestas del
// fondo (como el mapa dividido Radiant/Dire), la referencia al juego.
const RADIANT_GREEN = "#7CB93D";
const DIRE_RED = "#B0392B";

const RARITY_HEX: Record<Rarity, string> = {
  common: "#B0C3D9",
  uncommon: "#5E98D9",
  rare: "#4B69FF",
  mythical: "#8847FF",
  legendary: "#D32CE6",
  immortal: "#E4AE39",
  arcana: "#ADE55C",
  ancient: "#EB4B4B",
};

export interface PdfItem {
  id: string;
  name: string;
  hero?: string;
  category: ItemCategory;
  price: number;
  stock: number;
  rarity: Rarity;
  imageDataUri: string | null;
}

const PAGE_W = 842;
const PAGE_H = 595;
const PAGE_PADDING = 16;
const CONTENT_WIDTH = PAGE_W - PAGE_PADDING * 2;
const GRID_GAP = 10;
const COLUMNS = 5;
const MAX_ROWS = 3;
const PER_PAGE = COLUMNS * MAX_ROWS;
const WIDTH_PCT = 0.188; // 5 columnas, con espacio para el gap entre ellas
const IMAGE_ASPECT = 1.5; // 3:2 — así vienen las imágenes de items de Steam
const CARD_TEXT_HEIGHT = 48; // alto aprox. de nombre + barra de precio
const SECTION_HEADING_HEIGHT = 20;
const FOOTER_RESERVE = 30;
const HEADER_HEIGHT = 30;

const ROW_HEIGHT = (CONTENT_WIDTH * WIDTH_PCT) / IMAGE_ASPECT + CARD_TEXT_HEIGHT;
const AVAILABLE_GRID_HEIGHT = PAGE_H - PAGE_PADDING * 2 - HEADER_HEIGHT - SECTION_HEADING_HEIGHT - FOOTER_RESERVE;
const AVAILABLE_GRID_HEIGHT_NO_HEADING = AVAILABLE_GRID_HEIGHT + SECTION_HEADING_HEIGHT;

// Sólo importan las filas que entran por hoja (3 = 15 items); el resto pasa
// a la siguiente hoja sola. Centra la grilla verticalmente en el espacio
// disponible en vez de dejarla pegada arriba.
function computeGridMarginTop(itemCount: number, hasHeading: boolean): number {
  const rows = Math.min(Math.ceil(itemCount / COLUMNS), MAX_ROWS);
  const contentHeight = rows * ROW_HEIGHT + (rows - 1) * GRID_GAP;
  const available = hasHeading ? AVAILABLE_GRID_HEIGHT : AVAILABLE_GRID_HEIGHT_NO_HEADING;
  return Math.max(0, (available - contentHeight) / 2);
}

const styles = StyleSheet.create({
  page: {
    padding: PAGE_PADDING,
    fontSize: 8,
    color: ON_SURFACE,
    fontFamily: "Helvetica",
    backgroundColor: BACKGROUND,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    paddingBottom: 5,
    borderBottomWidth: 1.5,
    borderBottomColor: SECONDARY,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  brandLogo: { width: 20, height: 20, objectFit: "contain", borderRadius: 3 },
  brandText: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: PRIMARY,
    letterSpacing: 1,
  },
  sectionBlock: { flexDirection: "column" },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 1,
    marginBottom: 4,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: SECONDARY,
  },
  sectionCount: { fontSize: 8, color: ON_SURFACE_VARIANT },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: GRID_GAP,
    rowGap: GRID_GAP,
    justifyContent: "center",
  },
  card: { position: "relative", width: `${WIDTH_PCT * 100}%` },
  cardInner: {
    backgroundColor: SURFACE,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  // Marcos dorados en las 4 esquinas, tipo cofre de tesoro.
  cornerAccent: { position: "absolute", width: 12, height: 12 },
  rarityStrip: { height: 3.5, width: "100%" },
  imageWrap: {
    width: "100%",
    aspectRatio: IMAGE_ASPECT,
    backgroundColor: IMAGE_BG,
    justifyContent: "center",
    alignItems: "center",
  },
  image: { width: "100%", height: "100%", objectFit: "contain" },
  name: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: ON_SURFACE,
    textAlign: "center",
    paddingHorizontal: 6,
    paddingTop: 5,
    paddingBottom: 5,
  },
  priceBar: {
    backgroundColor: PRICE_BAR,
    paddingVertical: 5,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "baseline",
    gap: 3,
  },
  currency: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: SECONDARY, opacity: 0.85 },
  amount: { fontSize: 15, fontFamily: "Helvetica-Bold", color: SECONDARY },
  agotado: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#FF6B55", letterSpacing: 1 },
  footer: {
    position: "absolute",
    bottom: 10,
    left: PAGE_PADDING,
    right: PAGE_PADDING,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
  },
  footerText: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: ON_SURFACE_VARIANT },
  footerAccent: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: PRIMARY },
  pageNumber: { position: "absolute", bottom: 8, right: PAGE_PADDING, fontSize: 6, color: ON_SURFACE_VARIANT },
});

// Posiciones fijas (no aleatorias, para que el PDF sea reproducible) de
// pequeños diamantes dorados esparcidos por el fondo.
const SPARKS: Array<[number, number, number]> = [
  [70, 90, 5], [780, 60, 4], [40, 480, 4.5], [810, 300, 5],
  [400, 40, 3.5], [620, 520, 4], [180, 560, 3.5], [740, 420, 3],
  [300, 250, 3], [520, 180, 4], [90, 250, 3], [660, 150, 3.5],
];

function PageBackground() {
  const step = 34;
  const offset = 220;
  const lines = [];
  for (let x = -offset; x < PAGE_W + offset; x += step) {
    lines.push(
      <Line key={x} x1={x} y1={0} x2={x + offset} y2={PAGE_H} stroke={SECONDARY} strokeWidth={0.6} strokeOpacity={0.05} />,
    );
  }
  const frameInset = 8;
  return (
    <Svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} fixed>
      {/* Dire (rojo) arriba a la derecha */}
      <Polygon points={`${PAGE_W},0 ${PAGE_W},${PAGE_H * 0.62} ${PAGE_W * 0.38},0`} fill={DIRE_RED} fillOpacity={0.1} />
      {/* Radiant (verde) abajo a la izquierda */}
      <Polygon points={`0,${PAGE_H} 0,${PAGE_H * 0.38} ${PAGE_W * 0.62},${PAGE_H}`} fill={RADIANT_GREEN} fillOpacity={0.09} />
      {lines}
      {SPARKS.map(([cx, cy, r], i) => (
        <Polygon
          key={i}
          points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
          fill={SECONDARY}
          fillOpacity={0.16}
        />
      ))}
      {/* Marco doble dorado tipo "pergamino premium" alrededor de toda la hoja */}
      <Rect x={frameInset} y={frameInset} width={PAGE_W - frameInset * 2} height={PAGE_H - frameInset * 2} stroke={SECONDARY} strokeWidth={1} strokeOpacity={0.35} fill="none" />
      <Rect x={frameInset + 4} y={frameInset + 4} width={PAGE_W - (frameInset + 4) * 2} height={PAGE_H - (frameInset + 4) * 2} stroke={SECONDARY} strokeWidth={0.5} strokeOpacity={0.2} fill="none" />
    </Svg>
  );
}

function ItemCard({ item }: { item: PdfItem }) {
  const outOfStock = item.stock <= 0;
  const rarityColor = RARITY_HEX[item.rarity];
  return (
    <View style={styles.card} wrap={false}>
      <View style={styles.cardInner}>
        <View style={[styles.rarityStrip, { backgroundColor: rarityColor }]} />
        <View style={styles.imageWrap}>
          {item.imageDataUri ? (
            <Image src={item.imageDataUri} style={styles.image} />
          ) : (
            <Text style={{ fontSize: 7, color: ON_SURFACE_VARIANT }}>Sin imagen</Text>
          )}
        </View>
        <Text style={styles.name}>{item.name}</Text>
        <View style={[styles.priceBar, { borderWidth: 1.5, borderColor: rarityColor }]}>
          {outOfStock ? (
            <Text style={styles.agotado}>AGOTADO</Text>
          ) : (
            <>
              <Text style={styles.currency}>S/</Text>
              <Text style={styles.amount}>{item.price.toFixed(2)}</Text>
            </>
          )}
        </View>
      </View>
      <View style={[styles.cornerAccent, { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2, borderColor: SECONDARY, borderTopLeftRadius: 5 }]} />
      <View style={[styles.cornerAccent, { top: -1, right: -1, borderTopWidth: 2, borderRightWidth: 2, borderColor: SECONDARY, borderTopRightRadius: 5 }]} />
      <View style={[styles.cornerAccent, { bottom: -1, left: -1, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: SECONDARY, borderBottomLeftRadius: 5 }]} />
      <View style={[styles.cornerAccent, { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2, borderColor: SECONDARY, borderBottomRightRadius: 5 }]} />
    </View>
  );
}

export function CatalogPdfDocument({
  items,
  logoDataUri,
  validFrom,
  validTo,
}: {
  items: PdfItem[];
  logoDataUri: string | null;
  validFrom?: string;
  validTo?: string;
}) {
  const byCategory = new Map<ItemCategory, PdfItem[]>();
  for (const item of items) {
    const list = byCategory.get(item.category);
    if (list) list.push(item);
    else byCategory.set(item.category, [item]);
  }
  const categoryOrder = Array.from(byCategory.keys()).sort(
    (a, b) => byCategory.get(b)!.length - byCategory.get(a)!.length,
  );

  interface PageBlock {
    key: string;
    category: ItemCategory;
    items: PdfItem[];
    total: number;
    isFirstChunk: boolean;
  }
  const blocks: PageBlock[] = [];
  for (const category of categoryOrder) {
    const categoryItems = byCategory
      .get(category)!
      .sort((a, b) => (a.hero ?? "").localeCompare(b.hero ?? "") || a.name.localeCompare(b.name));
    for (let offset = 0; offset < categoryItems.length; offset += PER_PAGE) {
      blocks.push({
        key: `${category}-${offset}`,
        category,
        items: categoryItems.slice(offset, offset + PER_PAGE),
        total: categoryItems.length,
        isFirstChunk: offset === 0,
      });
    }
  }

  const hasValidity = Boolean(validFrom && validTo);

  return (
    <Document title="Catálogo PanteraStore">
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
        <PageBackground />

        <View style={styles.headerRow} fixed>
          <View style={styles.brandRow}>
            {logoDataUri && <Image src={logoDataUri} style={styles.brandLogo} />}
            <Text style={styles.brandText}>PANTERASTORE</Text>
          </View>
          <Text style={{ fontSize: 8, color: ON_SURFACE_VARIANT }}>Catálogo de items Dota 2</Text>
        </View>

        {blocks.map(({ key, category, items: blockItems, total, isFirstChunk }, index) => {
          const gridMarginTop = computeGridMarginTop(blockItems.length, isFirstChunk);
          return (
            <View key={key} break={index > 0} style={styles.sectionBlock}>
              {isFirstChunk && (
                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionTitle}>{CATEGORY_LABEL[category]}</Text>
                  <Text style={styles.sectionCount}>
                    {total} item{total === 1 ? "" : "s"}
                  </Text>
                </View>
              )}
              <View style={[styles.grid, { marginTop: gridMarginTop }]}>
                {blockItems.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </View>
            </View>
          );
        })}

        <View style={styles.footer} fixed>
          {hasValidity && (
            <Text style={styles.footerText}>
              Precios válidos desde <Text style={styles.footerAccent}>{validFrom}</Text> hasta{" "}
              <Text style={styles.footerAccent}>{validTo}</Text>
            </Text>
          )}
          <Text style={styles.footerText}>Entrega Inmediata</Text>
        </View>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
