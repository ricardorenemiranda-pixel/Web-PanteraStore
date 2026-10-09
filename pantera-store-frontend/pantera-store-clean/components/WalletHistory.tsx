import {
  ENTRY_TYPE_LABEL,
  type LedgerEntry,
  centsToPEN,
  signedCentsToPEN,
} from "@/lib/walletApi";

function deltaClass(cents: number): string {
  if (cents > 0) return "text-primary";
  if (cents < 0) return "text-error";
  return "text-on-surface-variant";
}

/** Historial de movimientos: se usa tanto en "Mi billetera" como en la vista de admin. */
export default function WalletHistory({
  entries,
  showAuthor = false,
}: {
  entries: LedgerEntry[];
  showAuthor?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <div className="surface-card p-8 text-center text-on-surface-variant" style={{ borderRadius: 0 }}>
        Todavía no hay movimientos.
      </div>
    );
  }

  return (
    <div className="surface-card overflow-x-auto" style={{ borderRadius: 0 }}>
      <table className="w-full text-left border-collapse min-w-[640px]">
        <thead>
          <tr className="border-b border-outline-variant font-label-caps text-[10px] uppercase text-on-surface-variant">
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Movimiento</th>
            <th className="px-4 py-3 text-right">Disponible</th>
            <th className="px-4 py-3 text-right">Bloqueado</th>
            <th className="px-4 py-3 text-right">Saldo después</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-outline-variant/60 last:border-0">
              <td className="px-4 py-3 font-body-sm text-on-surface-variant whitespace-nowrap">
                {new Date(entry.createdAt).toLocaleString("es-PE")}
              </td>
              <td className="px-4 py-3">
                <span className="font-body-md text-on-surface">{ENTRY_TYPE_LABEL[entry.type]}</span>
                {(entry.description || showAuthor) && (
                  <span className="block font-body-sm text-on-surface-variant">
                    {entry.description}
                    {showAuthor && entry.createdBy ? ` · por ${entry.createdBy}` : ""}
                  </span>
                )}
              </td>
              <td className={`px-4 py-3 text-right figure-nums ${deltaClass(entry.availableDeltaCents)}`}>
                {signedCentsToPEN(entry.availableDeltaCents)}
              </td>
              <td className={`px-4 py-3 text-right figure-nums ${deltaClass(entry.lockedDeltaCents)}`}>
                {signedCentsToPEN(entry.lockedDeltaCents)}
              </td>
              <td className="px-4 py-3 text-right figure-nums text-on-surface-variant">
                {centsToPEN(entry.availableAfterCents)}
                {entry.lockedAfterCents > 0 && (
                  <span className="block text-[11px]">{centsToPEN(entry.lockedAfterCents)} bloq.</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
