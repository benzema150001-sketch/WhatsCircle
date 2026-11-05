/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { io, Socket } from 'socket.io-client';
import type { Message, MessageReaction } from '../types/index.js';

let socket: Socket | null = null;

export function initializeSocket(sessionToken: string): Socket {
  if (socket) {
    socket.disconnect();
  }

  socket = io(window.location.origin, {
    auth: { sessionToken },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected to server, ID:', socket?.id);
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket] Connection error:', err.message);
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinRoomSocket(roomId: string) {
  if (socket && socket.connected) {
    socket.emit('room:join', { roomId });
  }
}

export function leaveRoomSocket(roomId: string) {
  if (socket && socket.connected) {
    socket.emit('room:leave', { roomId });
  }
}

export function sendTypingIndicator(conversationId: string, isTyping: boolean, roomId?: string, recipientId?: string) {
  if (socket && socket.connected) {
    socket.emit('chat:typing', {
      conversationId,
      roomId,
      recipientId,
      isTyping,
    });
  }
}

export function markMessagesReadSocket(conversationId: string, senderId?: string) {
  if (socket && socket.connected) {
    socket.emit('chat:mark_read', { conversationId, senderId });
  }
}

export function toggleReactionSocket(messageId: string, emoji: string, conversationId: string) {
  if (socket && socket.connected) {
    socket.emit('chat:reaction', { messageId, emoji, conversationId });
  }
}

export function deleteMessageSocket(messageId: string, conversationId: string, callback?: (res: { success?: boolean; error?: string }) => void) {
  if (socket && socket.connected) {
    socket.emit('chat:delete', { messageId, conversationId }, callback);
  }
}

export function sendMessageSocket(payload: {
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
}, callback?: (res: { success?: boolean; message?: Message; error?: string }) => void) {
  if (socket && socket.connected) {
    socket.emit('chat:send_message', payload, callback);
  } else if (callback) {
    callback({ error: 'Not connected to chat server' });
  }
}
