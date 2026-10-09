"use client";

interface Props {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Aceptar",
  cancelLabel = "Cancelar",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm glass-panel p-6">
        <div className="flex items-start gap-3 mb-6">
          <span
            className={`material-symbols-outlined text-2xl shrink-0 ${danger ? "text-error" : "text-secondary"}`}
          >
            {danger ? "warning" : "help"}
          </span>
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-1">
              {title ?? (danger ? "Confirmar eliminación" : "Confirmar acción")}
            </h2>
            <p className="font-body-sm text-on-surface-variant whitespace-pre-line">{message}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 font-label-caps text-label-caps text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={
              danger
                ? "bg-error text-on-error px-4 py-2 font-label-caps text-label-caps hover:brightness-110 transition-all disabled:opacity-50"
                : "bg-primary text-on-primary px-4 py-2 font-label-caps text-label-caps hover:brightness-110 transition-all disabled:opacity-50"
            }
          >
            {loading ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
