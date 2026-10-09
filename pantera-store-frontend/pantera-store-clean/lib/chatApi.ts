import { request } from "./adminApi";

export interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  body: string;
  createdAt: string;
}

export function fetchChatHistory(limit = 50): Promise<ChatMessage[]> {
  return request<ChatMessage[]>(`/chat/history?limit=${limit}`);
}
