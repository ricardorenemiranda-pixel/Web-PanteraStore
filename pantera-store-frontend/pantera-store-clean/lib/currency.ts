/**
 * Formatea un monto numérico como Soles Peruanos (PEN).
 * Ej: formatPEN(1234.5) -> "S/ 1,234.50"
 */
export function formatPEN(amount: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
