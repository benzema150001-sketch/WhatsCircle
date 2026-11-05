/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { User, Room, Message, MessageReaction, ActivityLog, AppSettings, AdminMetrics } from '../types/index.ts';

const dbDir = path.resolve('data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dbDir, 'whatscircle.db');
const db = new Database(dbPath);

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    lower_username TEXT UNIQUE NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    avatar_color TEXT NOT NULL,
    status TEXT DEFAULT 'offline',
    last_seen INTEGER NOT NULL,
    is_banned INTEGER DEFAULT 0,
    ban_reason TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    topic TEXT,
    created_by TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    room_id TEXT,
    recipient_id TEXT,
    sender_id TEXT NOT NULL,
    sender_username TEXT NOT NULL,
    content TEXT NOT NULL,
    media_url TEXT,
    media_type TEXT,
    reply_to_id TEXT,
    reply_to_content TEXT,
    reply_to_sender TEXT,
    status TEXT DEFAULT 'sent',
    is_deleted INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
  CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);

  CREATE TABLE IF NOT EXISTS reactions (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    emoji TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(message_id, user_id, emoji)
  );

  CREATE INDEX IF NOT EXISTS idx_reactions_message ON reactions(message_id);

  CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    actor_username TEXT NOT NULL,
    target TEXT,
    details TEXT,
    ip TEXT,
    timestamp INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_login_attempts (
    ip TEXT PRIMARY KEY,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER DEFAULT 0,
    last_attempt INTEGER NOT NULL
  );
`);

// Color palette for avatars
const AVATAR_COLORS = [
  '#00a884', '#008069', '#128c7e', '#075e54', '#25d366',
  '#34b7f1', '#1f85de', '#6c5ce7', '#e17055', '#d63031',
  '#e84393', '#fdcb6e', '#0984e3', '#00cec9', '#6c5ce7'
];

export function getRandomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

// Seed initial settings and default General room
export function initSeedData() {
  const insertSetting = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
  insertSetting.run('allow_new_users', 'true');
  insertSetting.run('invite_code', '');
  insertSetting.run('max_upload_mb', '5');
  insertSetting.run('banned_words', 'spam,scam,phishing,malware,viagra');

  // Seed default General room
  const checkRoom = db.prepare(`SELECT * FROM rooms WHERE id = 'room_general'`).get();
  if (!checkRoom) {
    const insertRoom = db.prepare(`
      INSERT INTO rooms (id, name, topic, created_by, is_default, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const now = Date.now();
    insertRoom.run('room_general', 'General', 'Welcome to the circle! Catch up, chat, and share.', 'system', 1, now);

    // Initial welcome message
    const insertMsg = db.prepare(`
      INSERT INTO messages (id, conversation_id, room_id, recipient_id, sender_id, sender_username, content, status, is_deleted, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertMsg.run(
      'msg_welcome',
      'room:room_general',
      'room_general',
      null,
      'user_system',
      'CircleBot',
      '👋 Welcome to WhatsCircle! Choose any unique name to chat instantly. Enjoy private direct messages, custom rooms, reactions, and image sharing.',
      'read',
      0,
      now
    );

    addLog('system_init', 'system', 'room_general', 'Seeded default General room and settings', '127.0.0.1');
  }
}

// Initialize seed
initSeedData();

// --- USER OPERATIONS ---
export function getUserBySession(token: string): User | null {
  const row = db.prepare(`SELECT * FROM users WHERE session_token = ?`).get(token) as any;
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    avatarColor: row.avatar_color,
    status: row.status,
    lastSeen: row.last_seen,
    isBanned: Boolean(row.is_banned),
    banReason: row.ban_reason,
    createdAt: row.created_at,
  };
}

export function getUserById(id: string): User | null {
  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    avatarColor: row.avatar_color,
    status: row.status,
    lastSeen: row.last_seen,
    isBanned: Boolean(row.is_banned),
    banReason: row.ban_reason,
    createdAt: row.created_at,
  };
}

export function getUserByUsername(username: string): User | null {
  const row = db.prepare(`SELECT * FROM users WHERE lower_username = ?`).get(username.trim().toLowerCase()) as any;
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    avatarColor: row.avatar_color,
    status: row.status,
    lastSeen: row.last_seen,
    isBanned: Boolean(row.is_banned),
    banReason: row.ban_reason,
    createdAt: row.created_at,
  };
}

export function createUser(username: string): { user: User; sessionToken: string } {
  const id = 'usr_' + crypto.randomBytes(8).toString('hex');
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const avatarColor = getRandomAvatarColor();
  const now = Date.now();

  const stmt = db.prepare(`
    INSERT INTO users (id, username, lower_username, session_token, avatar_color, status, last_seen, is_banned, created_at)
    VALUES (?, ?, ?, ?, ?, 'online', ?, 0, ?)
  `);
  stmt.run(id, username.trim(), username.trim().toLowerCase(), sessionToken, avatarColor, now, now);

  return {
    user: {
      id,
      username: username.trim(),
      avatarColor,
      status: 'online',
      lastSeen: now,
      isBanned: false,
      createdAt: now,
    },
    sessionToken,
  };
}

export function updateUserStatus(userId: string, status: 'online' | 'offline') {
  const stmt = db.prepare(`UPDATE users SET status = ?, last_seen = ? WHERE id = ?`);
  stmt.run(status, Date.now(), userId);
}

export function renameUser(userId: string, newUsername: string) {
  const stmt = db.prepare(`UPDATE users SET username = ?, lower_username = ? WHERE id = ?`);
  stmt.run(newUsername.trim(), newUsername.trim().toLowerCase(), userId);
  // Also update sender_username in messages
  db.prepare(`UPDATE messages SET sender_username = ? WHERE sender_id = ?`).run(newUsername.trim(), userId);
  db.prepare(`UPDATE reactions SET username = ? WHERE user_id = ?`).run(newUsername.trim(), userId);
}

export function banUser(userId: string, reason?: string) {
  const stmt = db.prepare(`UPDATE users SET is_banned = 1, ban_reason = ?, status = 'offline' WHERE id = ?`);
  stmt.run(reason || 'Banned by admin', userId);
}

export function unbanUser(userId: string) {
  const stmt = db.prepare(`UPDATE users SET is_banned = 0, ban_reason = NULL WHERE id = ?`);
  stmt.run(userId);
}

export function deleteUser(userId: string) {
  db.prepare(`DELETE FROM users WHERE id = ?`).run(userId);
}

export function getAllUsers(): User[] {
  const rows = db.prepare(`SELECT * FROM users ORDER BY last_seen DESC`).all() as any[];
  return rows.map(row => ({
    id: row.id,
    username: row.username,
    avatarColor: row.avatar_color,
    status: row.status,
    lastSeen: row.last_seen,
    isBanned: Boolean(row.is_banned),
    banReason: row.ban_reason,
    createdAt: row.created_at,
  }));
}

// --- ROOM OPERATIONS ---
export function getAllRooms(): Room[] {
  const rows = db.prepare(`SELECT * FROM rooms ORDER BY is_default DESC, created_at ASC`).all() as any[];
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    topic: row.topic,
    createdBy: row.created_by,
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
  }));
}

export function getRoomById(id: string): Room | null {
  const row = db.prepare(`SELECT * FROM rooms WHERE id = ?`).get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    topic: row.topic,
    createdBy: row.created_by,
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
  };
}

export function createRoom(name: string, topic?: string, createdBy: string = 'user'): Room {
  const id = 'room_' + crypto.randomBytes(6).toString('hex');
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO rooms (id, name, topic, created_by, is_default, created_at)
    VALUES (?, ?, ?, ?, 0, ?)
  `);
  stmt.run(id, name.trim(), topic ? topic.trim() : null, createdBy, now);
  return {
    id,
    name: name.trim(),
    topic: topic ? topic.trim() : undefined,
    createdBy,
    isDefault: false,
    createdAt: now,
  };
}

export function renameRoom(id: string, name: string, topic?: string) {
  const stmt = db.prepare(`UPDATE rooms SET name = ?, topic = ? WHERE id = ?`);
  stmt.run(name.trim(), topic ? topic.trim() : null, id);
}

export function deleteRoom(id: string) {
  db.prepare(`DELETE FROM rooms WHERE id = ? AND is_default = 0`).run(id);
  db.prepare(`DELETE FROM messages WHERE room_id = ?`).run(id);
}

export function clearRoomMessages(id: string) {
  db.prepare(`DELETE FROM messages WHERE room_id = ?`).run(id);
}

// --- MESSAGE OPERATIONS ---
export function createMessage(msg: {
  conversationId: string;
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
  status?: 'sent' | 'delivered' | 'read';
}): Message {
  const id = 'msg_' + crypto.randomBytes(8).toString('hex');
  const now = Date.now();
  const status = msg.status || 'sent';

  const stmt = db.prepare(`
    INSERT INTO messages (
      id, conversation_id, room_id, recipient_id, sender_id, sender_username,
      content, media_url, media_type, reply_to_id, reply_to_content, reply_to_sender,
      status, is_deleted, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `);

  stmt.run(
    id,
    msg.conversationId,
    msg.roomId || null,
    msg.recipientId || null,
    msg.senderId,
    msg.senderUsername,
    msg.content,
    msg.mediaUrl || null,
    msg.mediaType || null,
    msg.replyToId || null,
    msg.replyToContent || null,
    msg.replyToSender || null,
    status,
    now
  );

  return {
    id,
    conversationId: msg.conversationId,
    roomId: msg.roomId,
    recipientId: msg.recipientId,
    senderId: msg.senderId,
    senderUsername: msg.senderUsername,
    content: msg.content,
    mediaUrl: msg.mediaUrl,
    mediaType: msg.mediaType,
    replyToId: msg.replyToId,
    replyToContent: msg.replyToContent,
    replyToSender: msg.replyToSender,
    status,
    isDeleted: false,
    createdAt: now,
    reactions: [],
  };
}

export function getMessageById(id: string): Message | null {
  const row = db.prepare(`SELECT * FROM messages WHERE id = ?`).get(id) as any;
  if (!row) return null;
  const reactions = getReactionsForMessage(id);
  return {
    id: row.id,
    conversationId: row.conversation_id,
    roomId: row.room_id,
    recipientId: row.recipient_id,
    senderId: row.sender_id,
    senderUsername: row.sender_username,
    content: Boolean(row.is_deleted) ? 'This message was deleted' : row.content,
    mediaUrl: Boolean(row.is_deleted) ? null : row.media_url,
    mediaType: Boolean(row.is_deleted) ? null : row.media_type,
    replyToId: row.reply_to_id,
    replyToContent: row.reply_to_content,
    replyToSender: row.reply_to_sender,
    status: row.status,
    isDeleted: Boolean(row.is_deleted),
    createdAt: row.created_at,
    reactions,
  };
}

export function getMessagesByConversation(conversationId: string, limit: number = 100): Message[] {
  const rows = db.prepare(`
    SELECT * FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at ASC
    LIMIT ?
  `).all(conversationId, limit) as any[];

  if (rows.length === 0) return [];
  const messageIds = rows.map(r => r.id);
  const reactionsMap = getReactionsForMessageIds(messageIds);

  return rows.map(row => ({
    id: row.id,
    conversationId: row.conversation_id,
    roomId: row.room_id,
    recipientId: row.recipient_id,
    senderId: row.sender_id,
    senderUsername: row.sender_username,
    content: Boolean(row.is_deleted) ? 'This message was deleted' : row.content,
    mediaUrl: Boolean(row.is_deleted) ? null : row.media_url,
    mediaType: Boolean(row.is_deleted) ? null : row.media_type,
    replyToId: row.reply_to_id,
    replyToContent: row.reply_to_content,
    replyToSender: row.reply_to_sender,
    status: row.status,
    isDeleted: Boolean(row.is_deleted),
    createdAt: row.created_at,
    reactions: reactionsMap[row.id] || [],
  }));
}

export function deleteMessage(id: string, actorId?: string, isAdmin: boolean = false): boolean {
  const msg = db.prepare(`SELECT * FROM messages WHERE id = ?`).get(id) as any;
  if (!msg) return false;
  if (!isAdmin && actorId && msg.sender_id !== actorId) {
    return false;
  }
  db.prepare(`UPDATE messages SET is_deleted = 1, content = 'This message was deleted', media_url = NULL WHERE id = ?`).run(id);
  return true;
}

export function markMessagesDelivered(conversationId: string, recipientId: string) {
  db.prepare(`
    UPDATE messages
    SET status = 'delivered'
    WHERE conversation_id = ?
      AND sender_id != ?
      AND status = 'sent'
  `).run(conversationId, recipientId);
}

export function markMessagesRead(conversationId: string, readerId: string) {
  db.prepare(`
    UPDATE messages
    SET status = 'read'
    WHERE conversation_id = ?
      AND sender_id != ?
      AND status IN ('sent', 'delivered')
  `).run(conversationId, readerId);
}

// --- REACTIONS ---
export function toggleReaction(messageId: string, userId: string, username: string, emoji: string): MessageReaction[] {
  const existing = db.prepare(`
    SELECT * FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?
  `).get(messageId, userId, emoji);

  if (existing) {
    db.prepare(`DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?`).run(messageId, userId, emoji);
  } else {
    const id = 'rx_' + crypto.randomBytes(6).toString('hex');
    db.prepare(`
      INSERT INTO reactions (id, message_id, user_id, username, emoji, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, messageId, userId, username, emoji, Date.now());
  }

  return getReactionsForMessage(messageId);
}

export function getReactionsForMessage(messageId: string): MessageReaction[] {
  const rows = db.prepare(`SELECT * FROM reactions WHERE message_id = ? ORDER BY created_at ASC`).all(messageId) as any[];
  return rows.map(r => ({
    id: r.id,
    messageId: r.message_id,
    userId: r.user_id,
    username: r.username,
    emoji: r.emoji,
    createdAt: r.created_at,
  }));
}

export function getReactionsForMessageIds(messageIds: string[]): Record<string, MessageReaction[]> {
  if (messageIds.length === 0) return {};
  const placeholders = messageIds.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT * FROM reactions WHERE message_id IN (${placeholders}) ORDER BY created_at ASC
  `).all(...messageIds) as any[];

  const map: Record<string, MessageReaction[]> = {};
  for (const r of rows) {
    if (!map[r.message_id]) map[r.message_id] = [];
    map[r.message_id].push({
      id: r.id,
      messageId: r.message_id,
      userId: r.user_id,
      username: r.username,
      emoji: r.emoji,
      createdAt: r.created_at,
    });
  }
  return map;
}

// --- ACTIVITY LOGS ---
export function addLog(action: string, actorUsername: string, target?: string, details?: string, ip?: string) {
  const id = 'log_' + crypto.randomBytes(6).toString('hex');
  db.prepare(`
    INSERT INTO logs (id, action, actor_username, target, details, ip, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, action, actorUsername, target || null, details || null, ip || null, Date.now());
}

export function getLogs(limit: number = 100): ActivityLog[] {
  const rows = db.prepare(`SELECT * FROM logs ORDER BY timestamp DESC LIMIT ?`).all(limit) as any[];
  return rows.map(r => ({
    id: r.id,
    action: r.action,
    actorUsername: r.actor_username,
    target: r.target,
    details: r.details,
    ip: r.ip,
    timestamp: r.timestamp,
  }));
}

// --- SETTINGS ---
export function getAppSettings(): AppSettings {
  const rows = db.prepare(`SELECT key, value FROM settings`).all() as any[];
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }
  return {
    allowNewUsers: map['allow_new_users'] !== 'false',
    inviteCode: map['invite_code'] || '',
    maxUploadMb: parseFloat(map['max_upload_mb'] || '5') || 5,
    bannedWords: (map['banned_words'] || '')
      .split(',')
      .map(w => w.trim().toLowerCase())
      .filter(Boolean),
  };
}

export function updateAppSettings(settings: Partial<AppSettings>) {
  const stmt = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`);
  if (typeof settings.allowNewUsers === 'boolean') {
    stmt.run('allow_new_users', String(settings.allowNewUsers));
  }
  if (typeof settings.inviteCode === 'string') {
    stmt.run('invite_code', settings.inviteCode.trim());
  }
  if (typeof settings.maxUploadMb === 'number') {
    stmt.run('max_upload_mb', String(settings.maxUploadMb));
  }
  if (Array.isArray(settings.bannedWords)) {
    stmt.run('banned_words', settings.bannedWords.join(','));
  }
}

// --- ADMIN RATE LIMITING ---
export function checkAdminLoginLockout(ip: string): { isLocked: boolean; remainingSeconds?: number } {
  const row = db.prepare(`SELECT * FROM admin_login_attempts WHERE ip = ?`).get(ip) as any;
  if (!row) return { isLocked: false };
  const now = Date.now();
  if (row.locked_until && row.locked_until > now) {
    return {
      isLocked: true,
      remainingSeconds: Math.ceil((row.locked_until - now) / 1000),
    };
  }
  return { isLocked: false };
}

export function recordFailedAdminLogin(ip: string): { lockedNow: boolean; remainingSeconds?: number } {
  const now = Date.now();
  const row = db.prepare(`SELECT * FROM admin_login_attempts WHERE ip = ?`).get(ip) as any;
  let attempts = (row?.failed_attempts || 0) + 1;
  let lockedUntil = 0;

  if (attempts >= 5) {
    lockedUntil = now + 15 * 60 * 1000; // 15 minutes lockout
  }

  db.prepare(`
    INSERT INTO admin_login_attempts (ip, failed_attempts, locked_until, last_attempt)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(ip) DO UPDATE SET
      failed_attempts = excluded.failed_attempts,
      locked_until = excluded.locked_until,
      last_attempt = excluded.last_attempt
  `).run(ip, attempts, lockedUntil, now);

  if (lockedUntil > now) {
    return { lockedNow: true, remainingSeconds: 15 * 60 };
  }
  return { lockedNow: false };
}

export function resetAdminLoginAttempts(ip: string) {
  db.prepare(`DELETE FROM admin_login_attempts WHERE ip = ?`).run(ip);
}

// --- ADMIN METRICS ---
export function getAdminMetrics(): AdminMetrics {
  const totalUsers = (db.prepare(`SELECT COUNT(*) as count FROM users`).get() as any).count;
  const onlineUsers = (db.prepare(`SELECT COUNT(*) as count FROM users WHERE status = 'online'`).get() as any).count;
  const bannedUsers = (db.prepare(`SELECT COUNT(*) as count FROM users WHERE is_banned = 1`).get() as any).count;
  const activeRooms = (db.prepare(`SELECT COUNT(*) as count FROM rooms`).get() as any).count;
  const totalMessages = (db.prepare(`SELECT COUNT(*) as count FROM messages`).get() as any).count;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const messagesToday = (db.prepare(`SELECT COUNT(*) as count FROM messages WHERE created_at >= ?`).get(startOfDay.getTime()) as any).count;

  return {
    totalUsers,
    onlineUsers,
    messagesToday,
    activeRooms,
    bannedUsers,
    totalMessages,
  };
}

// --- ADMIN MESSAGE SEARCH & EXPORT ---
export function searchAdminMessages(query?: string, roomId?: string, limit: number = 200): Message[] {
  let sql = `SELECT * FROM messages WHERE 1=1`;
  const params: any[] = [];

  if (roomId) {
    sql += ` AND room_id = ?`;
    params.push(roomId);
  }
  if (query) {
    sql += ` AND content LIKE ?`;
    params.push(`%${query}%`);
  }
  sql += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);

  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map(row => ({
    id: row.id,
    conversationId: row.conversation_id,
    roomId: row.room_id,
    recipientId: row.recipient_id,
    senderId: row.sender_id,
    senderUsername: row.sender_username,
    content: row.content,
    mediaUrl: row.media_url,
    mediaType: row.media_type,
    replyToId: row.reply_to_id,
    replyToContent: row.reply_to_content,
    replyToSender: row.reply_to_sender,
    status: row.status,
    isDeleted: Boolean(row.is_deleted),
    createdAt: row.created_at,
  }));
}

export function exportChatData(format: 'json' | 'csv'): string {
  const rows = db.prepare(`
    SELECT id, conversation_id, room_id, sender_username, content, status, is_deleted, datetime(created_at/1000, 'unixepoch') as formatted_date
    FROM messages
    ORDER BY created_at ASC
  `).all() as any[];

  if (format === 'json') {
    return JSON.stringify(rows, null, 2);
  }

  // CSV format
  const headers = ['ID', 'Conversation', 'Room ID', 'Sender', 'Content', 'Status', 'Is Deleted', 'Timestamp'];
  const csvRows = [headers.join(',')];
  for (const r of rows) {
    const escapedContent = `"${(r.content || '').replace(/"/g, '""')}"`;
    csvRows.push([
      r.id,
      r.conversation_id,
      r.room_id || '',
      r.sender_username,
      escapedContent,
      r.status,
      r.is_deleted,
      r.formatted_date,
    ].join(','));
  }
  return csvRows.join('\n');
}
