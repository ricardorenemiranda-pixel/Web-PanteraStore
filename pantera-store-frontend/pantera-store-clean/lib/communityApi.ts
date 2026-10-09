import { request } from "./adminApi";

export type ActivityKind = "prize" | "bonus" | "sanction";

export interface ActivityFeedItem {
  id: string;
  kind: ActivityKind;
  message: string;
  createdAt: string;
}

export const ACTIVITY_KIND_ICON: Record<ActivityKind, string> = {
  prize: "emoji_events",
  bonus: "redeem",
  sanction: "gavel",
};

export function fetchActivityFeed(limit = 50): Promise<ActivityFeedItem[]> {
  return request<ActivityFeedItem[]>(`/community/feed?limit=${limit}`);
}

export function fetchCommunityConfig(): Promise<{ discordInviteUrl: string | null }> {
  return request("/community/config");
}
