/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import {
  getUserBySession,
  getUserById,
  updateUserStatus,
  createMessage,
  deleteMessage,
  markMessagesDelivered,
  markMessagesRead,
  toggleReaction,
  getAppSettings,
  addLog,
  getRoomById,
} from './db.ts';
import type { Message, User } from '../types/index.ts';

// Track online sockets per user (user can have multiple tabs)
const userSocketsMap = new Map<string, Set<string>>();

// Spam prevention: track message timestamps per user
const userMessageRateMap = new Map<string, number[]>();

export function setupSocketIO(io: SocketIOServer) {
  // Authentication middleware
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.sessionToken || socket.handshake.query?.token;
    if (!token || typeof token !== 'string') {
      return next(new Error('Authentication token required'));
    }

    const user = getUserBySession(token);
    if (!user) {
      return next(new Error('Invalid or expired session'));
    }

    if (user.isBanned) {
      return next(new Error(`Account is banned: ${user.banReason || 'Banned by admin'}`));
    }

    (socket as any).user = user;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user as User;
    const userId = user.id;

    // Register socket
    if (!userSocketsMap.has(userId)) {
      userSocketsMap.set(userId, new Set());
    }
    userSocketsMap.get(userId)!.add(socket.id);

    // Join personal user room for direct messages and targeted notices
    socket.join(`user:${userId}`);

    // Update status to online in DB
    updateUserStatus(userId, 'online');

    // Broadcast online status to all
    io.emit('user:status_change', {
      userId,
      username: user.username,
      status: 'online',
      lastSeen: Date.now(),
    });

    // Automatically join default General room
    socket.join('room:room_general');

    // 1. Join room
    socket.on('room:join', ({ roomId }: { roomId: string }) => {
      if (!roomId) return;
      socket.join(`room:${roomId}`);
    });

    // 2. Leave room
    socket.on('room:leave', ({ roomId }: { roomId: string }) => {
      if (!roomId) return;
      socket.leave(`room:${roomId}`);
    });

    // 3. Send message
    socket.on('chat:send_message', (payload: {
      conversationId: string;
      roomId?: string | null;
      recipientId?: string | null;
      content: string;
      mediaUrl?: string | null;
      mediaType?: string | null;
      replyToId?: string | null;
      replyToContent?: string | null;
      replyToSender?: string | null;
      tempId?: string;
    }, callback) => {
      try {
        // Spam rate limiting: max 5 messages per 3 seconds
        const now = Date.now();
        const timestamps = userMessageRateMap.get(userId) || [];
        const recent = timestamps.filter(t => now - t < 3000);
        if (recent.length >= 5) {
          if (callback) callback({ error: 'Please slow down! Message rate limit exceeded.' });
          return;
        }
        recent.push(now);
        userMessageRateMap.set(userId, recent);

        let content = (payload.content || '').trim();
        if (!content && !payload.mediaUrl) {
          if (callback) callback({ error: 'Message cannot be empty.' });
          return;
        }

        // Banned words filter
        const settings = getAppSettings();
        for (const word of settings.bannedWords) {
          if (word && content.toLowerCase().includes(word)) {
            const regex = new RegExp(word, 'gi');
            content = content.replace(regex, '***');
          }
        }

        // Check delivery status
        let initialStatus: 'sent' | 'delivered' = 'sent';
        if (payload.recipientId) {
          const recipientSockets = userSocketsMap.get(payload.recipientId);
          if (recipientSockets && recipientSockets.size > 0) {
            initialStatus = 'delivered';
          }
        } else if (payload.roomId) {
          initialStatus = 'delivered';
        }

        // Persist message
        const message = createMessage({
          conversationId: payload.conversationId,
          roomId: payload.roomId,
          recipientId: payload.recipientId,
          senderId: userId,
          senderUsername: user.username,
          content,
          mediaUrl: payload.mediaUrl,
          mediaType: payload.mediaType,
          replyToId: payload.replyToId,
          replyToContent: payload.replyToContent,
          replyToSender: payload.replyToSender,
          status: initialStatus,
        });

        // Broadcast to conversation participants
        if (payload.roomId) {
          // Broadcast to everyone in the room except sender (who already has optimistic update)
          io.to(`room:${payload.roomId}`).emit('chat:new_message', {
            message,
            tempId: payload.tempId,
          });
        } else if (payload.recipientId) {
          // Send to recipient
          io.to(`user:${payload.recipientId}`).emit('chat:new_message', {
            message,
            tempId: payload.tempId,
          });
          // Also echo back to any other sessions of the sender
          io.to(`user:${userId}`).emit('chat:new_message', {
            message,
            tempId: payload.tempId,
          });
        }

        if (callback) callback({ success: true, message, tempId: payload.tempId });
      } catch (err: any) {
        if (callback) callback({ error: err.message || 'Failed to send message' });
      }
    });

    // 4. Typing indicator
    socket.on('chat:typing', ({ conversationId, roomId, recipientId, isTyping }: {
      conversationId: string;
      roomId?: string;
      recipientId?: string;
      isTyping: boolean;
    }) => {
      const payload = {
        conversationId,
        userId,
        username: user.username,
        isTyping,
      };

      if (roomId) {
        socket.to(`room:${roomId}`).emit('chat:user_typing', payload);
      } else if (recipientId) {
        socket.to(`user:${recipientId}`).emit('chat:user_typing', payload);
      }
    });

    // 5. Message read receipt
    socket.on('chat:mark_read', ({ conversationId, senderId }: { conversationId: string; senderId?: string }) => {
      markMessagesRead(conversationId, userId);
      // Notify sender that their messages were read
      if (senderId) {
        io.to(`user:${senderId}`).emit('chat:status_update', {
          conversationId,
          readerId: userId,
          status: 'read',
        });
      }
    });

    // 6. Message reaction
    socket.on('chat:reaction', ({ messageId, emoji, conversationId }: {
      messageId: string;
      emoji: string;
      conversationId: string;
    }) => {
      if (!messageId || !emoji) return;
      const reactions = toggleReaction(messageId, userId, user.username, emoji);
      io.emit('chat:reaction_update', {
        messageId,
        conversationId,
        reactions,
      });
    });

    // 7. Delete own message
    socket.on('chat:delete', ({ messageId, conversationId }: { messageId: string; conversationId: string }, callback) => {
      const success = deleteMessage(messageId, userId, false);
      if (success) {
        io.emit('chat:message_deleted', {
          messageId,
          conversationId,
        });
        if (callback) callback({ success: true });
      } else {
        if (callback) callback({ error: 'Cannot delete this message' });
      }
    });

    // On disconnect
    socket.on('disconnect', () => {
      const sockets = userSocketsMap.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSocketsMap.delete(userId);
          updateUserStatus(userId, 'offline');
          io.emit('user:status_change', {
            userId,
            username: user.username,
            status: 'offline',
            lastSeen: Date.now(),
          });
        }
      }
    });
  });

  return {
    broadcastAnnouncement: (announcement: string) => {
      io.emit('system:announcement', {
        id: 'ann_' + Date.now(),
        content: announcement,
        timestamp: Date.now(),
      });
    },
    kickUserSockets: (targetUserId: string, reason: string) => {
      io.to(`user:${targetUserId}`).emit('system:force_disconnect', {
        reason: reason || 'You have been disconnected by the administrator.',
      });
      const sockets = userSocketsMap.get(targetUserId);
      if (sockets) {
        for (const sId of sockets) {
          const s = io.sockets.sockets.get(sId);
          if (s) s.disconnect(true);
        }
        userSocketsMap.delete(targetUserId);
      }
      updateUserStatus(targetUserId, 'offline');
      io.emit('user:status_change', {
        userId: targetUserId,
        status: 'offline',
        lastSeen: Date.now(),
      });
    },
    notifyRoomCreated: (room: any) => {
      io.emit('room:created', room);
    },
    notifyRoomDeleted: (roomId: string) => {
      io.emit('room:deleted', { roomId });
    },
    notifyRoomRenamed: (roomId: string, name: string, topic?: string) => {
      io.emit('room:renamed', { roomId, name, topic });
    },
    notifyChatCleared: (roomId: string) => {
      io.emit('chat:cleared', { roomId });
    },
    notifyUserRenamed: (targetUserId: string, newUsername: string) => {
      io.emit('user:renamed', { userId: targetUserId, newUsername });
    },
  };
}
