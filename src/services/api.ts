/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { User, Room, Message, AppSettings, AdminMetrics, ActivityLog } from '../types/index.js';

const API_BASE = '/api';

export async function joinChat(username: string, inviteCode?: string): Promise<{ user: User; sessionToken: string }> {
  const res = await fetch(`${API_BASE}/auth/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, inviteCode }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to join chat');
  }
  return data;
}

export async function verifySession(sessionToken: string): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/verify-session`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    const error: any = new Error(data.error || 'Session invalid');
    error.isBanned = data.isBanned;
    error.banReason = data.banReason;
    throw error;
  }
  return data.user;
}

export async function leaveChat(sessionToken: string): Promise<void> {
  await fetch(`${API_BASE}/auth/leave`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
}

export async function getPublicSettings(): Promise<{ allowNewUsers: boolean; hasInviteCode: boolean; maxUploadMb: number }> {
  const res = await fetch(`${API_BASE}/settings/public`);
  return res.json();
}

export async function getUsers(sessionToken: string): Promise<User[]> {
  const res = await fetch(`${API_BASE}/users`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load users');
  return data.users;
}

export async function getRooms(sessionToken: string): Promise<Room[]> {
  const res = await fetch(`${API_BASE}/rooms`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load rooms');
  return data.rooms;
}

export async function createRoom(sessionToken: string, name: string, topic?: string): Promise<Room> {
  const res = await fetch(`${API_BASE}/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ name, topic }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create room');
  return data.room;
}

export async function getConversationMessages(sessionToken: string, conversationId: string): Promise<Message[]> {
  const res = await fetch(`${API_BASE}/messages/${encodeURIComponent(conversationId)}`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load messages');
  return data.messages;
}

export async function uploadImage(
  sessionToken: string,
  dataUrl: string,
  fileName: string,
  mimeType: string
): Promise<{ url: string; type: string }> {
  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ dataUrl, fileName, mimeType }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to upload image');
  return data;
}

// --- ADMIN API ---

export async function adminLogin(username: string, password: string): Promise<{ token: string; csrfToken: string; username: string }> {
  const res = await fetch(`${API_BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    const error: any = new Error(data.error || 'Admin login failed');
    error.status = res.status;
    error.remainingSeconds = data.remainingSeconds;
    throw error;
  }
  return data;
}

export async function adminLogout(token: string): Promise<void> {
  await fetch(`${API_BASE}/admin/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getAdminMetrics(token: string): Promise<AdminMetrics> {
  const res = await fetch(`${API_BASE}/admin/metrics`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch metrics');
  return data.metrics;
}

export async function getAdminUsers(token: string): Promise<User[]> {
  const res = await fetch(`${API_BASE}/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch users');
  return data.users;
}

export async function kickUser(token: string, csrf: string, userId: string, reason?: string) {
  const res = await fetch(`${API_BASE}/admin/users/${userId}/kick`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-admin-csrf': csrf,
    },
    body: JSON.stringify({ reason }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to kick user');
  return data;
}

export async function banUser(token: string, csrf: string, userId: string, reason?: string) {
  const res = await fetch(`${API_BASE}/admin/users/${userId}/ban`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-admin-csrf': csrf,
    },
    body: JSON.stringify({ reason }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to ban user');
  return data;
}

export async function unbanUser(token: string, csrf: string, userId: string) {
  const res = await fetch(`${API_BASE}/admin/users/${userId}/unban`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-admin-csrf': csrf,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to unban user');
  return data;
}

export async function renameUser(token: string, csrf: string, userId: string, newUsername: string) {
  const res = await fetch(`${API_BASE}/admin/users/${userId}/rename`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-admin-csrf': csrf,
    },
    body: JSON.stringify({ newUsername }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to rename user');
  return data;
}

export async function deleteUser(token: string, csrf: string, userId: string) {
  const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-admin-csrf': csrf,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete user');
  return data;
}

export async function getAdminMessages(token: string, q?: string, roomId?: string): Promise<Message[]> {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (roomId) params.set('roomId', roomId);
  const res = await fetch(`${API_BASE}/admin/messages?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load messages');
  return data.messages;
}

export async function deleteAdminMessage(token: string, csrf: string, messageId: string) {
  const res = await fetch(`${API_BASE}/admin/messages/${messageId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-admin-csrf': csrf,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete message');
  return data;
}

export async function getAdminRooms(token: string): Promise<Room[]> {
  const res = await fetch(`${API_BASE}/admin/rooms`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load rooms');
  return data.rooms;
}

export async function createAdminRoom(token: string, csrf: string, name: string, topic?: string): Promise<Room> {
  const res = await fetch(`${API_BASE}/admin/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-admin-csrf': csrf,
    },
    body: JSON.stringify({ name, topic }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create room');
  return data.room;
}

export async function renameAdminRoom(token: string, csrf: string, roomId: string, name: string, topic?: string) {
  const res = await fetch(`${API_BASE}/admin/rooms/${roomId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-admin-csrf': csrf,
    },
    body: JSON.stringify({ name, topic }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to rename room');
  return data;
}

export async function deleteAdminRoom(token: string, csrf: string, roomId: string) {
  const res = await fetch(`${API_BASE}/admin/rooms/${roomId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-admin-csrf': csrf,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete room');
  return data;
}

export async function clearAdminRoom(token: string, csrf: string, roomId: string) {
  const res = await fetch(`${API_BASE}/admin/rooms/${roomId}/clear`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-admin-csrf': csrf,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to clear chat');
  return data;
}

export async function broadcastAnnouncement(token: string, csrf: string, announcement: string) {
  const res = await fetch(`${API_BASE}/admin/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-admin-csrf': csrf,
    },
    body: JSON.stringify({ announcement }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to broadcast announcement');
  return data;
}

export async function getAdminSettings(token: string): Promise<AppSettings> {
  const res = await fetch(`${API_BASE}/admin/settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load settings');
  return data.settings;
}

export async function updateAdminSettings(token: string, csrf: string, settings: Partial<AppSettings>): Promise<AppSettings> {
  const res = await fetch(`${API_BASE}/admin/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-admin-csrf': csrf,
    },
    body: JSON.stringify(settings),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update settings');
  return data.settings;
}

export async function getAdminLogs(token: string): Promise<ActivityLog[]> {
  const res = await fetch(`${API_BASE}/admin/logs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load logs');
  return data.logs;
}
