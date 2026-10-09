import { ACTIVITY_KIND_ICON, type ActivityFeedItem } from "@/lib/communityApi";

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "hace un momento";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

/** Lista de "qué está pasando" (premios, bonos, sanciones). Usado en /comunidad y en el sidebar de /salas. */
export default function ActivityFeedList({
  items,
  compact = false,
}: {
  items: ActivityFeedItem[];
  compact?: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className={`text-center text-on-surface-variant font-body-sm ${compact ? "p-4" : "surface-card p-8"}`} style={compact ? undefined : { borderRadius: 0 }}>
        Todavía no hay actividad para mostrar.
      </div>
    );
  }
  return (
    <div className={`flex flex-col ${compact ? "gap-1.5" : "gap-2"}`}>
      {items.map((item) => (
        <div
          key={item.id}
          className={`flex items-start gap-2.5 ${compact ? "py-1.5" : "surface-card px-4 py-3 items-center gap-3"}`}
          style={compact ? undefined : { borderRadius: 0 }}
        >
          <span className={`material-symbols-outlined text-primary shrink-0 ${compact ? "text-base mt-0.5" : "text-xl"}`}>
            {ACTIVITY_KIND_ICON[item.kind]}
          </span>
          <p className="font-body-sm text-on-surface flex-1 min-w-0">{item.message}</p>
          <span className="font-body-sm text-on-surface-variant shrink-0 whitespace-nowrap">{timeAgo(item.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}
