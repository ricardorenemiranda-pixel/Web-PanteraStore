import type { NextApiRequest, NextApiResponse } from "next";
import { renderToBuffer } from "@react-pdf/renderer";
import { BACKEND_URL } from "@/lib/config";
import { CatalogPdfDocument, type PdfItem } from "@/lib/pdf/CatalogPdfDocument";

// Ruta del Pages Router (no app/api) a propósito: @react-pdf/renderer trae su
// propio reconciler de React, y dentro de un Route Handler del App Router
// (que participa del pipeline de React Server Components) termina viendo dos
// instancias distintas de React. El Pages Router no tiene ese problema.

const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const FETCH_TIMEOUT_MS = 8000;

interface AdminItemResponse {
  id: string;
  name: string;
  hero?: string;
  category: PdfItem["category"];
  rarity: PdfItem["rarity"];
  price: number;
  stock: number;
  published: boolean;
  imageUrl?: string;
}

async function toDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type")?.split(";")[0].trim();
    if (!contentType || !SUPPORTED_IMAGE_TYPES.has(contentType)) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }

  // Esta ruta corre en el servidor de Next — el fetch del browser hacia el
  // backend usa `credentials: "include"` porque corre en el cliente; acá hay
  // que reenviar la cookie de sesión del admin a mano.
  const backendRes = await fetch(`${BACKEND_URL}/items/admin`, {
    headers: req.headers.cookie ? { cookie: req.headers.cookie } : undefined,
  });

  if (backendRes.status === 401 || backendRes.status === 403) {
    res.status(backendRes.status).json({ error: "No autorizado." });
    return;
  }
  if (!backendRes.ok) {
    res.status(502).json({ error: "No se pudo leer el catálogo." });
    return;
  }

  const items = (await backendRes.json()) as AdminItemResponse[];
  const published = items.filter((item) => item.published);

  const pdfItems: PdfItem[] = await Promise.all(
    published.map(async (item) => ({
      id: item.id,
      name: item.name,
      hero: item.hero,
      category: item.category,
      price: item.price,
      stock: item.stock,
      rarity: item.rarity,
      imageDataUri: item.imageUrl ? await toDataUri(item.imageUrl) : null,
    })),
  );

  const validFrom = typeof req.query.validFrom === "string" ? req.query.validFrom : undefined;
  const validTo = typeof req.query.validTo === "string" ? req.query.validTo : undefined;

  const buffer = await renderToBuffer(
    CatalogPdfDocument({ items: pdfItems, logoDataUri: null, validFrom, validTo }),
  );
  const filename = `catalogo-panterastore-${new Date().toISOString().slice(0, 10)}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.status(200).send(buffer);
}
