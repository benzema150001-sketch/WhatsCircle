/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Ensure tsx does not leak relative '.' __dirname to ESM imports in Node 22
if ((globalThis as any).__dirname === '.') {
  delete (globalThis as any).__dirname;
}

import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';

import {
  getUserBySession,
  getUserByUsername,
  getUserById,
  createUser,
  getAllUsers,
  getAllRooms,
  getRoomById,
  createRoom,
  renameRoom,
  deleteRoom,
  clearRoomMessages,
  getMessagesByConversation,
  deleteMessage,
  addLog,
  getLogs,
  getAppSettings,
  updateAppSettings,
  getAdminMetrics,
  searchAdminMessages,
  exportChatData,
  banUser,
  unbanUser,
  renameUser,
  deleteUser,
} from './src/server/db.ts';
import { loginAdmin, logoutAdmin, verifyAdmin } from './src/server/auth.ts';
import { setupSocketIO } from './src/server/socket.ts';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 10 * 1024 * 1024, // 10MB
});

const socketManager = setupSocketIO(io);

// Uploads directory
const uploadsDir = path.resolve('public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(uploadsDir));

// --- USER SESSION AUTH ROUTES ---

// 1. Join Chat (Choose a username)
app.post('/api/auth/join', (req, res) => {
  const { username, inviteCode } = req.body;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Username is required.' });
  }

  const trimmed = username.trim();
  // Validate: 3-20 characters, alphanumeric + underscore only
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usernameRegex.test(trimmed)) {
    return res.status(400).json({
      error: 'Username must be 3-20 characters and contain only letters, numbers, and underscores.',
    });
  }

  const settings = getAppSettings();

  // Check if new registrations are allowed
  if (!settings.allowNewUsers) {
    return res.status(403).json({
      error: 'New registrations are currently closed by the circle administrator.',
    });
  }

  // Check invite code if configured
  if (settings.inviteCode && settings.inviteCode.trim() !== '') {
    if (!inviteCode || inviteCode.trim() !== settings.inviteCode.trim()) {
      return res.status(401).json({
        error: 'Invalid circle invite code. Please contact the administrator.',
      });
    }
  }

  // Case-insensitive uniqueness check
  const existing = getUserByUsername(trimmed);
  if (existing) {
    return res.status(409).json({
      error: `The username "${trimmed}" is already reserved on another device in this circle. Please pick a different name.`,
    });
  }

  // Create user and generate secure session token
  const result = createUser(trimmed);
  addLog('user_join', trimmed, result.user.id, `User joined from ${ip}`, ip);

  return res.json({
    success: true,
    user: result.user,
    sessionToken: result.sessionToken,
  });
});

// 2. Verify existing session
app.get('/api/auth/verify-session', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || (req.query.token as string);
  if (!token) {
    return res.status(401).json({ error: 'No session token provided.' });
  }

  const user = getUserBySession(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired session. Please choose a username.' });
  }

  if (user.isBanned) {
    return res.status(403).json({
      error: 'Your account has been banned.',
      isBanned: true,
      banReason: user.banReason,
    });
  }

  return res.json({
    success: true,
    user,
  });
});

// 3. Leave / Release username
app.post('/api/auth/leave', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const user = getUserBySession(token);
    if (user) {
      addLog('user_leave', user.username, user.id, 'User manually left chat', req.ip);
    }
  }
  return res.json({ success: true, message: 'Session terminated' });
});

// --- CORE APP DATA ROUTES ---

// List users (for direct messaging)
app.get('/api/users', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !getUserBySession(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const users = getAllUsers().filter(u => !u.isBanned);
  return res.json({ users });
});

// List rooms
app.get('/api/rooms', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !getUserBySession(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const rooms = getAllRooms();
  return res.json({ rooms });
});

// Create new room
app.post('/api/rooms', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = token ? getUserBySession(token) : null;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { name, topic } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Room name is required.' });
  }

  const room = createRoom(name.trim(), topic, user.username);
  addLog('room_create', user.username, room.id, `Created room: #${room.name}`, req.ip);
  socketManager.notifyRoomCreated(room);

  return res.json({ success: true, room });
});

// Get messages for conversation
app.get('/api/messages/:conversationId', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = token ? getUserBySession(token) : null;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { conversationId } = req.params;
  const messages = getMessagesByConversation(conversationId, 150);
  return res.json({ messages });
});

// Image upload endpoint
app.post('/api/upload', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = token ? getUserBySession(token) : null;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { dataUrl, fileName, mimeType } = req.body;
  if (!dataUrl || typeof dataUrl !== 'string') {
    return res.status(400).json({ error: 'Missing image data.' });
  }

  // Check MIME type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
  const matches = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,(.+)$/);
  if (!matches) {
    return res.status(400).json({ error: 'Invalid image format.' });
  }

  const detectedMime = matches[1].toLowerCase();
  if (!allowedTypes.includes(detectedMime)) {
    return res.status(400).json({ error: 'Only PNG, JPEG, GIF, and WEBP images are allowed.' });
  }

  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');

  // Check upload size limit
  const settings = getAppSettings();
  const maxBytes = settings.maxUploadMb * 1024 * 1024;
  if (buffer.length > maxBytes) {
    return res.status(413).json({
      error: `Image exceeds maximum allowed size of ${settings.maxUploadMb} MB.`,
    });
  }

  // Generate safe filename and write to disk
  const ext = detectedMime.split('/')[1].replace('jpeg', 'jpg');
  const safeName = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = path.join(uploadsDir, safeName);

  fs.writeFileSync(filePath, buffer);

  const mediaUrl = `/uploads/${safeName}`;
  return res.json({
    success: true,
    url: mediaUrl,
    type: detectedMime,
  });
});

// App Settings (Public read for invite code hint)
app.get('/api/settings/public', (req, res) => {
  const settings = getAppSettings();
  return res.json({
    allowNewUsers: settings.allowNewUsers,
    hasInviteCode: Boolean(settings.inviteCode && settings.inviteCode.trim() !== ''),
    maxUploadMb: settings.maxUploadMb,
  });
});

// --- ADMIN API ROUTES (PROTECTED) ---

app.post('/api/admin/login', loginAdmin);
app.post('/api/admin/logout', logoutAdmin);

// Admin dashboard metrics
app.get('/api/admin/metrics', verifyAdmin, (req, res) => {
  const metrics = getAdminMetrics();
  return res.json({ metrics });
});

// Admin user management
app.get('/api/admin/users', verifyAdmin, (req, res) => {
  const users = getAllUsers();
  return res.json({ users });
});

app.post('/api/admin/users/:id/kick', verifyAdmin, (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const user = getUserById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  socketManager.kickUserSockets(id, reason || 'Disconnected by administrator');
  addLog('user_kick', (req as any).admin.username, user.username, reason || 'Kicked from circle', req.ip);
  return res.json({ success: true, message: `Kicked ${user.username}` });
});

app.post('/api/admin/users/:id/ban', verifyAdmin, (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const user = getUserById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  banUser(id, reason || 'Banned by administrator');
  socketManager.kickUserSockets(id, `You have been banned: ${reason || 'Violation of circle guidelines'}`);
  addLog('user_ban', (req as any).admin.username, user.username, reason || 'Banned by admin', req.ip);
  return res.json({ success: true, message: `Banned ${user.username}` });
});

app.post('/api/admin/users/:id/unban', verifyAdmin, (req, res) => {
  const { id } = req.params;
  const user = getUserById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  unbanUser(id);
  addLog('user_unban', (req as any).admin.username, user.username, 'Unbanned user', req.ip);
  return res.json({ success: true, message: `Unbanned ${user.username}` });
});

app.post('/api/admin/users/:id/rename', verifyAdmin, (req, res) => {
  const { id } = req.params;
  const { newUsername } = req.body;
  if (!newUsername || typeof newUsername !== 'string') {
    return res.status(400).json({ error: 'New username required' });
  }

  const trimmed = newUsername.trim();
  const existing = getUserByUsername(trimmed);
  if (existing && existing.id !== id) {
    return res.status(409).json({ error: 'Username already in use' });
  }

  const oldUser = getUserById(id);
  renameUser(id, trimmed);
  socketManager.notifyUserRenamed(id, trimmed);
  addLog('user_rename', (req as any).admin.username, `${oldUser?.username} -> ${trimmed}`, 'Renamed user', req.ip);
  return res.json({ success: true, newUsername: trimmed });
});

app.delete('/api/admin/users/:id', verifyAdmin, (req, res) => {
  const { id } = req.params;
  const user = getUserById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  socketManager.kickUserSockets(id, 'Your user profile was removed by administrator.');
  deleteUser(id);
  addLog('user_delete', (req as any).admin.username, user.username, 'Permanently deleted user', req.ip);
  return res.json({ success: true, message: `Deleted ${user.username}` });
});

// Admin message moderation
app.get('/api/admin/messages', verifyAdmin, (req, res) => {
  const { q, roomId } = req.query;
  const messages = searchAdminMessages(q as string, roomId as string);
  return res.json({ messages });
});

app.delete('/api/admin/messages/:id', verifyAdmin, (req, res) => {
  const { id } = req.params;
  const success = deleteMessage(id, undefined, true);
  if (!success) return res.status(404).json({ error: 'Message not found' });

  io.emit('chat:message_deleted', { messageId: id });
  addLog('message_delete', (req as any).admin.username, id, 'Admin deleted message', req.ip);
  return res.json({ success: true });
});

// Admin room management
app.get('/api/admin/rooms', verifyAdmin, (req, res) => {
  const rooms = getAllRooms();
  return res.json({ rooms });
});

app.post('/api/admin/rooms', verifyAdmin, (req, res) => {
  const { name, topic } = req.body;
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Room name required' });
  const room = createRoom(name.trim(), topic, (req as any).admin.username);
  socketManager.notifyRoomCreated(room);
  addLog('room_create', (req as any).admin.username, room.id, `Created room #${room.name}`, req.ip);
  return res.json({ success: true, room });
});

app.put('/api/admin/rooms/:id', verifyAdmin, (req, res) => {
  const { id } = req.params;
  const { name, topic } = req.body;
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Room name required' });

  renameRoom(id, name.trim(), topic);
  socketManager.notifyRoomRenamed(id, name.trim(), topic);
  addLog('room_rename', (req as any).admin.username, id, `Renamed room to #${name.trim()}`, req.ip);
  return res.json({ success: true });
});

app.delete('/api/admin/rooms/:id', verifyAdmin, (req, res) => {
  const { id } = req.params;
  const room = getRoomById(id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.isDefault) {
    return res.status(400).json({ error: 'Cannot delete the default General room' });
  }

  deleteRoom(id);
  socketManager.notifyRoomDeleted(id);
  addLog('room_delete', (req as any).admin.username, room.name, `Deleted room #${room.name}`, req.ip);
  return res.json({ success: true });
});

app.post('/api/admin/rooms/:id/clear', verifyAdmin, (req, res) => {
  const { id } = req.params;
  const room = getRoomById(id);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  clearRoomMessages(id);
  socketManager.notifyChatCleared(id);
  addLog('chat_cleared', (req as any).admin.username, room.name, `Cleared chat history for #${room.name}`, req.ip);
  return res.json({ success: true, message: `Cleared messages for #${room.name}` });
});

// Admin broadcast
app.post('/api/admin/broadcast', verifyAdmin, (req, res) => {
  const { announcement } = req.body;
  if (!announcement || typeof announcement !== 'string') {
    return res.status(400).json({ error: 'Announcement text required' });
  }

  socketManager.broadcastAnnouncement(announcement.trim());
  addLog('broadcast', (req as any).admin.username, 'all_users', announcement.trim(), req.ip);
  return res.json({ success: true, message: 'Broadcast dispatched to all connected users' });
});

// Admin settings
app.get('/api/admin/settings', verifyAdmin, (req, res) => {
  const settings = getAppSettings();
  return res.json({ settings });
});

app.put('/api/admin/settings', verifyAdmin, (req, res) => {
  const { allowNewUsers, inviteCode, maxUploadMb, bannedWords } = req.body;
  updateAppSettings({
    allowNewUsers,
    inviteCode,
    maxUploadMb,
    bannedWords,
  });
  addLog('settings_update', (req as any).admin.username, 'system_settings', 'Updated circle settings', req.ip);
  return res.json({ success: true, settings: getAppSettings() });
});

// Activity logs
app.get('/api/admin/logs', verifyAdmin, (req, res) => {
  const logs = getLogs(200);
  return res.json({ logs });
});

// Export chat history
app.get('/api/admin/export', verifyAdmin, (req, res) => {
  const format = (req.query.format as string) === 'csv' ? 'csv' : 'json';
  const data = exportChatData(format);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="whatscircle-chat-export-${Date.now()}.csv"`);
    return res.send(data);
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="whatscircle-chat-export-${Date.now()}.json"`);
  return res.send(data);
});

// --- CLIENT ROUTE HANDLING & VITE INTEGRATION ---

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`[WhatsCircle] Server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch(err => {
  console.error('[WhatsCircle] Failed to start server:', err);
  process.exit(1);
});
