/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MessageSquare, Bell, X, ShieldAlert } from 'lucide-react';
import { Sidebar } from './Sidebar.js';
import { ChatArea } from './ChatArea.js';
import { NewRoomModal } from './NewRoomModal.js';
import { NewChatModal } from './NewChatModal.js';
import { UserSettingsModal } from './UserSettingsModal.js';
import {
  getRooms,
  getUsers,
  getConversationMessages,
  leaveChat,
} from '../services/api.js';
import {
  initializeSocket,
  getSocket,
  disconnectSocket,
  joinRoomSocket,
  leaveRoomSocket,
  sendTypingIndicator,
  markMessagesReadSocket,
  toggleReactionSocket,
  deleteMessageSocket,
  sendMessageSocket,
} from '../services/socket.js';
import { useSound } from '../hooks/useSound.js';
import type { User, Room, Message, ActiveConversation } from '../types/index.js';

interface ChatLayoutProps {
  currentUser: User;
  sessionToken: string;
  isDark: boolean;
  onToggleTheme: () => void;
  onLeaveSession: () => void;
}

export const ChatLayout: React.FC<ChatLayoutProps> = ({
  currentUser,
  sessionToken,
  isDark,
  onToggleTheme,
  onLeaveSession,
}) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeConversation, setActiveConversation] = useState<ActiveConversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [latestMessages, setLatestMessages] = useState<Record<string, Message>>({});
  const [typingMap, setTypingMap] = useState<Record<string, string>>({}); // convId -> username
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [kickModal, setKickModal] = useState<string | null>(null);

  // Modals
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Sound & Notification Hook
  const {
    soundEnabled,
    toggleSound,
    notificationsEnabled,
    requestNotificationPermission,
    playReceiveChime,
    playSendPop,
    triggerNotification,
  } = useSound();

  // Create fast user lookup map
  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    for (const u of users) {
      map.set(u.id, u);
    }
    map.set(currentUser.id, currentUser);
    return map;
  }, [users, currentUser]);

  // Derive conversation key
  const getConversationKey = (conv: ActiveConversation | null): string => {
    if (!conv) return '';
    if (conv.type === 'room') return `room:${conv.id}`;
    const pair = [currentUser.id, conv.id].sort();
    return `dm:${pair[0]}:${pair[1]}`;
  };

  const currentConvKey = getConversationKey(activeConversation);

  // Initial load: rooms and users
  useEffect(() => {
    let mounted = true;
    Promise.all([getRooms(sessionToken), getUsers(sessionToken)])
      .then(([rList, uList]) => {
        if (!mounted) return;
        setRooms(rList);
        setUsers(uList);

        // Default open General room on desktop
        const general = rList.find(r => r.isDefault) || rList[0];
        if (general && !activeConversation && window.innerWidth >= 768) {
          setActiveConversation({
            type: 'room',
            id: general.id,
            title: general.name,
            subtitle: general.topic || 'Group Room',
            isDefault: general.isDefault,
          });
        }
      })
      .catch((err) => {
        console.error('Initial load failed:', err);
      });

    return () => {
      mounted = false;
    };
  }, [sessionToken]);

  // Connect Socket.IO
  useEffect(() => {
    const socket = initializeSocket(sessionToken);

    // 1. New message
    socket.on('chat:new_message', ({ message, tempId }: { message: Message; tempId?: string }) => {
      setMessages((prev) => {
        // Reconcile optimistic message
        if (tempId) {
          const index = prev.findIndex(m => m.id === tempId);
          if (index !== -1) {
            const next = [...prev];
            next[index] = message;
            return next;
          }
        }
        // Guard against duplicate
        if (prev.some(m => m.id === message.id)) {
          return prev;
        }
        // If message belongs to active conversation
        if (message.conversationId === currentConvKey) {
          return [...prev, message];
        }
        return prev;
      });

      // Update latest messages preview
      setLatestMessages(prev => ({ ...prev, [message.conversationId]: message }));

      // Sound & Notification & Unread counters
      if (message.senderId !== currentUser.id) {
        if (message.conversationId === currentConvKey) {
          playReceiveChime();
          // Mark as read immediately
          markMessagesReadSocket(currentConvKey, message.senderId);
        } else {
          playReceiveChime();
          triggerNotification(`New message from ${message.senderUsername}`, message.content || 'Sent an image');
          setUnreadCounts(prev => ({
            ...prev,
            [message.conversationId]: (prev[message.conversationId] || 0) + 1,
          }));
        }
      }
    });

    // 2. Status update (e.g. read receipts)
    socket.on('chat:status_update', ({ conversationId, status }: { conversationId: string; status: 'delivered' | 'read' }) => {
      setMessages(prev =>
        prev.map(m => (m.conversationId === conversationId && m.senderId === currentUser.id ? { ...m, status } : m))
      );
    });

    // 3. Reaction update
    socket.on('chat:reaction_update', ({ messageId, reactions }: { messageId: string; reactions: any[] }) => {
      setMessages(prev =>
        prev.map(m => (m.id === messageId ? { ...m, reactions } : m))
      );
    });

    // 4. Message deleted
    socket.on('chat:message_deleted', ({ messageId }: { messageId: string }) => {
      setMessages(prev =>
        prev.map(m =>
          m.id === messageId
            ? { ...m, isDeleted: true, content: 'This message was deleted', mediaUrl: null }
            : m
        )
      );
    });

    // 5. Typing indicator
    socket.on('chat:user_typing', ({ conversationId, username, isTyping }: { conversationId: string; username: string; isTyping: boolean }) => {
      setTypingMap(prev => {
        if (isTyping) {
          return { ...prev, [conversationId]: username };
        } else {
          const next = { ...prev };
          delete next[conversationId];
          return next;
        }
      });
    });

    // 6. User status change (online / offline)
    socket.on('user:status_change', ({ userId, status, lastSeen }: { userId: string; status: 'online' | 'offline'; lastSeen: number }) => {
      setUsers(prev =>
        prev.map(u => (u.id === userId ? { ...u, status, lastSeen } : u))
      );
    });

    // 7. Room updates
    socket.on('room:created', (newRoom: Room) => {
      setRooms(prev => (prev.some(r => r.id === newRoom.id) ? prev : [...prev, newRoom]));
    });

    socket.on('room:deleted', ({ roomId }: { roomId: string }) => {
      setRooms(prev => prev.filter(r => r.id !== roomId));
      if (activeConversation?.type === 'room' && activeConversation.id === roomId) {
        setActiveConversation(null);
      }
    });

    socket.on('room:renamed', ({ roomId, name, topic }: { roomId: string; name: string; topic?: string }) => {
      setRooms(prev => prev.map(r => (r.id === roomId ? { ...r, name, topic } : r)));
      if (activeConversation?.type === 'room' && activeConversation.id === roomId) {
        setActiveConversation(prev => prev ? { ...prev, title: name, subtitle: topic || 'Group Room' } : null);
      }
    });

    socket.on('chat:cleared', ({ roomId }: { roomId: string }) => {
      if (activeConversation?.type === 'room' && activeConversation.id === roomId) {
        setMessages([]);
      }
    });

    // 8. System announcement broadcast
    socket.on('system:announcement', ({ content }: { content: string }) => {
      setAnnouncement(content);
      playReceiveChime();
    });

    // 9. Force disconnect / kick
    socket.on('system:force_disconnect', ({ reason }: { reason: string }) => {
      setKickModal(reason);
      disconnectSocket();
    });

    return () => {
      disconnectSocket();
    };
  }, [sessionToken, currentConvKey]);

  // When active conversation changes, load messages & clear unread
  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      return;
    }

    const convKey = getConversationKey(activeConversation);

    // Join room socket if room
    if (activeConversation.type === 'room') {
      joinRoomSocket(activeConversation.id);
    }

    // Load messages
    getConversationMessages(sessionToken, convKey)
      .then((history) => {
        setMessages(history);
        // Clear unread badge
        setUnreadCounts(prev => ({ ...prev, [convKey]: 0 }));
        // Mark read
        if (activeConversation.type === 'dm') {
          markMessagesReadSocket(convKey, activeConversation.id);
        }
      })
      .catch(err => {
        console.error('Failed to load conversation history:', err);
      });

    return () => {
      if (activeConversation.type === 'room') {
        leaveRoomSocket(activeConversation.id);
      }
    };
  }, [activeConversation?.id, activeConversation?.type, sessionToken]);

  // Handle Send Message
  const handleSendMessage = (content: string, mediaUrl?: string, replyTo?: Message) => {
    if (!activeConversation) return;

    playSendPop();

    const convKey = getConversationKey(activeConversation);
    const tempId = 'temp_' + Date.now();

    // Optimistic message
    const optimisticMsg: Message = {
      id: tempId,
      conversationId: convKey,
      roomId: activeConversation.type === 'room' ? activeConversation.id : null,
      recipientId: activeConversation.type === 'dm' ? activeConversation.id : null,
      senderId: currentUser.id,
      senderUsername: currentUser.username,
      content,
      mediaUrl: mediaUrl || null,
      mediaType: mediaUrl ? 'image/jpeg' : null,
      replyToId: replyTo?.id || null,
      replyToContent: replyTo?.content || null,
      replyToSender: replyTo?.senderUsername || null,
      status: 'sent',
      isDeleted: false,
      createdAt: Date.now(),
      reactions: [],
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setLatestMessages(prev => ({ ...prev, [convKey]: optimisticMsg }));

    sendMessageSocket(
      {
        conversationId: convKey,
        roomId: activeConversation.type === 'room' ? activeConversation.id : null,
        recipientId: activeConversation.type === 'dm' ? activeConversation.id : null,
        content,
        mediaUrl,
        replyToId: replyTo?.id,
        replyToContent: replyTo?.content,
        replyToSender: replyTo?.senderUsername,
        tempId,
      },
      (res) => {
        if (res.error) {
          console.warn('Send error:', res.error);
        }
      }
    );
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!activeConversation) return;
    deleteMessageSocket(messageId, currentConvKey);
  };

  const handleToggleReaction = (messageId: string, emoji: string) => {
    if (!activeConversation) return;
    toggleReactionSocket(messageId, emoji, currentConvKey);
  };

  const handleSendTyping = (isTyping: boolean) => {
    if (!activeConversation) return;
    sendTypingIndicator(
      currentConvKey,
      isTyping,
      activeConversation.type === 'room' ? activeConversation.id : undefined,
      activeConversation.type === 'dm' ? activeConversation.id : undefined
    );
  };

  const handleLeave = async () => {
    try {
      await leaveChat(sessionToken);
    } catch {}
    localStorage.removeItem('whatscircle_session');
    onLeaveSession();
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#efeae2] dark:bg-[#0c1317]">
      
      {/* Top System Announcement Banner if active */}
      {announcement && (
        <div className="h-10 px-4 bg-gradient-to-r from-amber-600 to-amber-700 text-white text-xs flex items-center justify-between z-30 shrink-0 shadow-md">
          <div className="flex items-center gap-2 font-medium truncate">
            <Bell className="w-4 h-4 animate-bounce shrink-0" />
            <span className="truncate"><strong>Announcement:</strong> {announcement}</span>
          </div>
          <button
            onClick={() => setAnnouncement(null)}
            className="p-1 hover:bg-black/20 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Two-Pane or Sliding View */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar (Full width on mobile if no active conversation) */}
        <div
          className={`h-full w-full md:w-80 lg:w-96 shrink-0 md:block ${
            activeConversation ? 'hidden md:block' : 'block'
          }`}
        >
          <Sidebar
            currentUser={currentUser}
            rooms={rooms}
            users={users}
            activeConversation={activeConversation}
            onSelectConversation={(conv) => setActiveConversation(conv)}
            onOpenNewRoom={() => setShowNewRoom(true)}
            onOpenNewChat={() => setShowNewChat(true)}
            onOpenSettings={() => setShowSettings(true)}
            isDark={isDark}
            onToggleTheme={onToggleTheme}
            unreadCounts={unreadCounts}
            latestMessages={latestMessages}
          />
        </div>

        {/* Right Chat Area (Full width on mobile when active conversation is selected) */}
        <div
          className={`h-full flex-1 md:block ${
            activeConversation ? 'block' : 'hidden md:block'
          }`}
        >
          {activeConversation ? (
            <ChatArea
              currentUser={currentUser}
              sessionToken={sessionToken}
              conversation={activeConversation}
              messages={messages}
              onSendMessage={handleSendMessage}
              onDeleteMessage={handleDeleteMessage}
              onToggleReaction={handleToggleReaction}
              onBackMobile={() => setActiveConversation(null)}
              isTypingUser={typingMap[currentConvKey]}
              onSendTyping={handleSendTyping}
              userMap={userMap}
            />
          ) : (
            /* Desktop Blank Slate Placeholder */
            <div className="h-full w-full hidden md:flex flex-col items-center justify-center p-8 bg-slate-100 dark:bg-[#222e35] text-center border-b-[6px] border-[#00a884]">
              <div className="w-20 h-20 rounded-3xl bg-[#00a884]/15 text-[#00a884] flex items-center justify-center mb-4 shadow-sm">
                <MessageSquare className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                WhatsCircle for Web
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md">
                Select a room or start a direct message with a circle friend to begin chatting in real time.
              </p>
              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={() => setShowNewChat(true)}
                  className="px-4 py-2 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  Start Direct Message
                </button>
                <button
                  onClick={() => setShowNewRoom(true)}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-[#111b21] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 shadow-sm transition cursor-pointer"
                >
                  Create New Room
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showNewRoom && (
        <NewRoomModal
          sessionToken={sessionToken}
          onClose={() => setShowNewRoom(false)}
          onRoomCreated={(newRoom) => {
            setRooms(prev => [...prev, newRoom]);
            setActiveConversation({
              type: 'room',
              id: newRoom.id,
              title: newRoom.name,
              subtitle: newRoom.topic || 'Group Room',
            });
          }}
        />
      )}

      {showNewChat && (
        <NewChatModal
          currentUserId={currentUser.id}
          users={users}
          onClose={() => setShowNewChat(false)}
          onSelectUser={(targetUser) => {
            setActiveConversation({
              type: 'dm',
              id: targetUser.id,
              title: targetUser.username,
              subtitle: targetUser.status === 'online' ? 'online' : 'offline',
              isOnline: targetUser.status === 'online',
              lastSeen: targetUser.lastSeen,
            });
          }}
        />
      )}

      {showSettings && (
        <UserSettingsModal
          currentUser={currentUser}
          isDark={isDark}
          onToggleTheme={onToggleTheme}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
          notificationsEnabled={notificationsEnabled}
          onRequestNotifications={requestNotificationPermission}
          onLeaveChat={handleLeave}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Kicked / Banned Disconnect Dialog */}
      {kickModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#111b21] p-6 text-center border border-red-500/30 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-500/15 text-red-500 flex items-center justify-center mx-auto mb-3">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Disconnected</h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              {kickModal}
            </p>
            <button
              onClick={() => {
                localStorage.removeItem('whatscircle_session');
                window.location.reload();
              }}
              className="mt-5 w-full py-2.5 rounded-xl bg-red-600 text-white font-semibold text-xs shadow-md hover:bg-red-700"
            >
              Return to Landing
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
