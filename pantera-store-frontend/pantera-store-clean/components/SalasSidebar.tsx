"use client";

import { useEffect, useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import ActivityFeedList from "@/components/ActivityFeedList";
import { type ActivityFeedItem, fetchActivityFeed } from "@/lib/communityApi";

/** Chat general + actividad reciente, fijos al costado de la lista de salas. */
export default function SalasSidebar() {
  const [feed, setFeed] = useState<ActivityFeedItem[]>([]);

  useEffect(() => {
    const load = () => fetchActivityFeed(15).then(setFeed).catch(() => undefined);
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, []);

  return (
    <aside className="hidden xl:flex flex-col gap-4 w-[340px] shrink-0 sticky top-24 h-[calc(100vh-7rem)]">
      <ChatPanel className="flex-1 min-h-0" />
      <div className="surface-card flex flex-col h-56 shrink-0" style={{ borderRadius: 0 }}>
        <div className="px-4 py-3 border-b border-outline-variant shrink-0">
          <span className="font-headline-md text-headline-md text-on-surface">Actividad</span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
          <ActivityFeedList items={feed} compact />
        </div>
      </div>
    </aside>
  );
}
