"use client";

import { useCallback, useEffect, useState } from "react";
import AdultConfirmModal from "@/components/AdultConfirmModal";
import { useAuth } from "@/lib/AuthContext";
import {
  DEPOSIT_STATUS_LABEL,
  METHOD_LABEL,
  type MyDeposit,
  type MyWithdrawal,
  PAYMENT_METHODS,
  type PaymentMethod,
  type PaymentsConfig,
  WITHDRAWAL_STATUS_LABEL,
  cancelDeposit,
  cancelWithdrawal,
  createDeposit,
  createWithdrawal,
  fetchMyPayments,
  fetchPaymentsConfig,
} from "@/lib/paymentsApi";
import { centsToPEN } from "@/lib/walletApi";

const inputClass = "bg-surface-container border border-on-surface/10 text-on-surface font-body-sm py-2 px-3 w-full";
const statusClass: Record<string, string> = {
  pending: "text-secondary border-secondary/30 bg-secondary/10",
  approved: "text-primary border-primary/30 bg-primary/10",
  paid: "text-primary border-primary/30 bg-primary/10",
  rejected: "text-error border-error/30 bg-error/10",
  cancelled: "text-on-surface-variant border-outline-variant",
};

const toCents = (soles: string) => Math.round(Number(soles) * 100);

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="surface-card w-full max-w-md p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto" style={{ borderRadius: 0 }}>
        <div className="flex justify-between items-start">
          <h2 className="font-headline-md text-headline-md text-on-surface">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-on-surface-variant hover:text-on-surface text-xl leading-none">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MethodPicker({ value, onChange }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {PAYMENT_METHODS.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`py-2 border font-label-caps text-label-caps ${value === m ? "bg-primary text-on-primary border-primary" : "border-outline-variant text-on-surface-variant hover:text-on-surface"}`}
        >
          {METHOD_LABEL[m]}
        </button>
      ))}
    </div>
  );
}

function DepositModal({ config, onClose, onDone }: { config: PaymentsConfig; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("yape");
  const [code, setCode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const l = config.limits.deposit;
  const where =
    method === "yape" ? config.instructions.yape : method === "plin" ? config.instructions.plin : config.instructions.bank;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Sube la foto o captura del comprobante.");
    setBusy(true);
    setError("");
    try {
      await createDeposit({ amountCents: toCents(amount), method, operationCode: code.trim() }, file);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la recarga.");
      setBusy(false);
    }
  }

  return (
    <Modal title="Recargar saldo" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <ol className="font-body-sm text-on-surface-variant list-decimal pl-5 flex flex-col gap-1">
          <li>Elige cómo vas a pagar y haz el pago.</li>
          <li>Escribe el monto y el número de operación, y sube el comprobante.</li>
          <li>Revisamos el pago y te acreditamos el saldo.</li>
        </ol>
        <MethodPicker value={method} onChange={setMethod} />
        <div className="bg-primary/10 border border-primary/20 p-3 font-body-sm text-on-surface">
          {where ? (
            <>
              Paga a: <span className="font-semibold figure-nums">{where}</span>
              {config.instructions.holder && <> · a nombre de {config.instructions.holder}</>}
            </>
          ) : (
            "Escríbenos por WhatsApp para pasarte los datos de pago."
          )}
        </div>
        <label className="flex flex-col gap-1">
          <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Monto pagado (S/)</span>
          <input className={inputClass} type="number" min={l.minCents / 100} max={l.maxCents / 100} step="0.5" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <span className="font-body-sm text-on-surface-variant">
            Entre {centsToPEN(l.minCents)} y {centsToPEN(l.maxCents)} por recarga · máximo {centsToPEN(l.dailyMaxCents)} al día.
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Número de operación</span>
          <input className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} placeholder="El que aparece en tu comprobante" maxLength={40} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Comprobante (imagen, máx. 2 MB)</span>
          <input className={inputClass} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {error && <div className="bg-error/10 border border-error/20 text-error px-4 py-3 text-body-sm">{error}</div>}
        <button type="submit" disabled={busy || !amount || !code || !file} className="bg-primary text-on-primary px-6 py-3 font-label-caps text-label-caps hover:brightness-110 disabled:opacity-50">
          {busy ? "Enviando..." : "Enviar recarga"}
        </button>
      </form>
    </Modal>
  );
}

function WithdrawModal({ config, availableCents, onClose, onDone }: { config: PaymentsConfig; availableCents: number; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("yape");
  const [destination, setDestination] = useState("");
  const [holder, setHolder] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const l = config.limits.withdrawal;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createWithdrawal({ amountCents: toCents(amount), method, destination: destination.trim(), holderName: holder.trim() });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo pedir el retiro.");
      setBusy(false);
    }
  }

  return (
    <Modal title="Retirar saldo" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="font-body-sm text-on-surface-variant">
          Tienes <span className="text-on-surface figure-nums">{centsToPEN(availableCents)}</span> disponibles. Al pedir el retiro ese monto se aparta;
          lo revisamos y te lo pagamos. Puedes cancelarlo mientras esté en revisión.
        </p>
        <MethodPicker value={method} onChange={setMethod} />
        <label className="flex flex-col gap-1">
          <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Monto (S/)</span>
          <input className={inputClass} type="number" min={l.minCents / 100} max={Math.min(l.maxCents, availableCents) / 100} step="0.5" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <span className="font-body-sm text-on-surface-variant">
            Entre {centsToPEN(l.minCents)} y {centsToPEN(l.maxCents)} por retiro · máximo {centsToPEN(l.dailyMaxCents)} al día.
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
            {method === "transfer" ? "Cuenta o CCI de destino" : `Celular de ${METHOD_LABEL[method]}`}
          </span>
          <input className={inputClass} value={destination} onChange={(e) => setDestination(e.target.value)} placeholder={method === "transfer" ? "20 dígitos" : "9 dígitos"} inputMode="numeric" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Nombre del titular</span>
          <input className={inputClass} value={holder} onChange={(e) => setHolder(e.target.value)} maxLength={80} />
        </label>
        {error && <div className="bg-error/10 border border-error/20 text-error px-4 py-3 text-body-sm">{error}</div>}
        <button type="submit" disabled={busy || !amount || !destination || !holder} className="bg-primary text-on-primary px-6 py-3 font-label-caps text-label-caps hover:brightness-110 disabled:opacity-50">
          {busy ? "Enviando..." : "Pedir retiro"}
        </button>
      </form>
    </Modal>
  );
}

/** Recargar, retirar y ver el estado de mis pedidos. Va dentro de "Mi billetera". */
export default function PaymentsPanel({ availableCents, onChanged }: { availableCents: number; onChanged: () => void }) {
  const { user } = useAuth();
  const [config, setConfig] = useState<PaymentsConfig | null>(null);
  const [deposits, setDeposits] = useState<MyDeposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<MyWithdrawal[]>([]);
  const [modal, setModal] = useState<"deposit" | "withdraw" | null>(null);
  const [gate, setGate] = useState<"deposit" | "withdraw" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    fetchPaymentsConfig().then(setConfig).catch(() => setConfig(null));
    fetchMyPayments()
      .then((p) => {
        setDeposits(p.deposits);
        setWithdrawals(p.withdrawals);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  function open(kind: "deposit" | "withdraw") {
    setMessage("");
    setError("");
    if (!user?.adultConfirmed) setGate(kind);
    else setModal(kind);
  }

  async function cancel(kind: "deposit" | "withdraw", id: string) {
    setError("");
    try {
      if (kind === "deposit") await cancelDeposit(id);
      else await cancelWithdrawal(id);
      load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar.");
    }
  }

  if (!config) return null;

  return (
    <section className="mb-10">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="font-headline-md text-headline-md text-on-surface mr-auto">Recargar y retirar</h2>
        <button type="button" onClick={() => open("deposit")} disabled={!config.enabled} className="bg-primary text-on-primary px-6 py-2.5 font-label-caps text-label-caps hover:brightness-110 disabled:opacity-40">
          Recargar
        </button>
        <button type="button" onClick={() => open("withdraw")} disabled={!config.enabled} className="border border-outline text-on-surface px-6 py-2.5 font-label-caps text-label-caps hover:bg-on-surface/5 disabled:opacity-40">
          Retirar
        </button>
      </div>

      {!config.enabled && (
        <div className="surface-card p-4 text-on-surface-variant font-body-sm mb-4" style={{ borderRadius: 0 }}>
          Las recargas y retiros todavía no están habilitados.
        </div>
      )}
      {message && <div className="mb-4 bg-primary/10 border border-primary/20 text-primary px-4 py-3 text-body-sm">{message}</div>}
      {error && <div className="mb-4 bg-error/10 border border-error/20 text-error px-4 py-3 text-body-sm">{error}</div>}

      {(deposits.length > 0 || withdrawals.length > 0) && (
        <div className="flex flex-col gap-2">
          {[
            ...deposits.map((d) => ({ kind: "deposit" as const, id: d.id, at: d.createdAt, cents: d.amountCents, method: d.method, status: d.status, label: DEPOSIT_STATUS_LABEL[d.status], note: d.note, extra: `operación ${d.operationCode}`, cancellable: d.status === "pending" })),
            ...withdrawals.map((w) => ({ kind: "withdraw" as const, id: w.id, at: w.createdAt, cents: w.amountCents, method: w.method, status: w.status, label: WITHDRAWAL_STATUS_LABEL[w.status], note: w.note, extra: `a ${w.destination}`, cancellable: w.status === "pending" })),
          ]
            .sort((a, b) => b.at.localeCompare(a.at))
            .map((r) => (
              <div key={`${r.kind}-${r.id}`} className="surface-card px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1" style={{ borderRadius: 0 }}>
                <span className="font-label-caps text-[10px] uppercase text-on-surface-variant w-20">{r.kind === "deposit" ? "Recarga" : "Retiro"}</span>
                <span className="figure-nums text-on-surface w-24">{centsToPEN(r.cents)}</span>
                <span className="font-body-sm text-on-surface-variant">
                  {METHOD_LABEL[r.method]} · {r.extra} · {new Date(r.at).toLocaleString("es-PE")}
                </span>
                <span className={`ml-auto px-3 py-1 border font-label-caps text-[10px] uppercase ${statusClass[r.status]}`}>{r.label}</span>
                {r.note && <span className="basis-full font-body-sm text-error">Motivo: {r.note}</span>}
                {r.cancellable && (
                  <button type="button" onClick={() => cancel(r.kind, r.id)} className="font-label-caps text-[10px] uppercase text-error hover:underline">
                    Cancelar
                  </button>
                )}
              </div>
            ))}
        </div>
      )}

      {gate && (
        <AdultConfirmModal
          onClose={() => setGate(null)}
          onConfirmed={() => {
            setModal(gate);
            setGate(null);
          }}
        />
      )}
      {modal === "deposit" && (
        <DepositModal
          config={config}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            setMessage("Recibimos tu recarga. La revisamos y te acreditamos el saldo en cuanto confirmemos el pago.");
            load();
          }}
        />
      )}
      {modal === "withdraw" && (
        <WithdrawModal
          config={config}
          availableCents={availableCents}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            setMessage("Pediste tu retiro. El monto quedó apartado hasta que lo revisemos y te paguemos.");
            load();
            onChanged();
          }}
        />
      )}
    </section>
  );
}
