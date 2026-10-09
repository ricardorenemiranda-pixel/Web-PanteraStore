import { redirect } from "next/navigation";

/** Next.js renderiza esto para cualquier ruta que no exista — la mandamos directo al inicio. */
export default function NotFound() {
  redirect("/");
}
