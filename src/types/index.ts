/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  username: string;
  avatarColor: string;
  status: 'online' | 'offline';
  lastSeen: number;
  isBanned?: boolean;
  banReason?: string;
  createdAt: number;
}

export interface Room {
  id: string;
  name: string;
  topic?: string;
  createdBy: string;
  isDefault: boolean;
  createdAt: number;
  unreadCount?: number;
  lastMessage?: Message;
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  username: string;
  emoji: string;
  createdAt: number;
}

export interface Message {
  id: string;
  conversationId: string; // e.g. "room:room_general" or "dm:id1:id2"
  roomId?: string | null;
  recipientId?: string | null;
  senderId: string;
  senderUsername: string;
  content: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  replyToId?: string | null;
  replyToContent?: string | null;
  replyToSender?: string | null;
  status: 'sent' | 'delivered' | 'read';
  isDeleted: boolean;
  createdAt: number;
  reactions?: MessageReaction[];
}

export interface ActivityLog {
  id: string;
  action: string;
  actorUsername: string;
  target?: string;
  details?: string;
  ip?: string;
  timestamp: number;
}

export interface AppSettings {
  allowNewUsers: boolean;
  inviteCode: string;
  maxUploadMb: number;
  bannedWords: string[];
}

export interface AdminMetrics {
  totalUsers: number;
  onlineUsers: number;
  messagesToday: number;
  activeRooms: number;
  bannedUsers: number;
  totalMessages: number;
}

export type ConversationType = 'room' | 'dm';

export interface ActiveConversation {
  type: ConversationType;
  id: string; // room id or other user id
  title: string;
  subtitle?: string;
  isOnline?: boolean;
  lastSeen?: number;
  isDefault?: boolean;
}
