/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  MessageSquarePlus,
  Hash,
  Search,
  Settings,
  Users,
  Moon,
  Sun,
  Plus,
  Check,
  CheckCheck,
} from 'lucide-react';
import type { User, Room, Message, ActiveConversation } from '../types/index.js';

interface SidebarProps {
  currentUser: User;
  rooms: Room[];
  users: User[];
  activeConversation: ActiveConversation | null;
  onSelectConversation: (conv: ActiveConversation) => void;
  onOpenNewRoom: () => void;
  onOpenNewChat: () => void;
  onOpenSettings: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  unreadCounts: Record<string, number>;
  latestMessages: Record<string, Message>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  rooms,
  users,
  activeConversation,
  onSelectConversation,
  onOpenNewRoom,
  onOpenNewChat,
  onOpenSettings,
  isDark,
  onToggleTheme,
  unreadCounts,
  latestMessages,
}) => {
  const [tab, setTab] = useState<'all' | 'rooms' | 'dms'>('all');
  const [search, setSearch] = useState('');

  const otherUsers = users.filter(u => u.id !== currentUser.id && !u.isBanned);

  const filteredRooms = rooms.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.topic && r.topic.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredUsers = otherUsers.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const formatPreviewTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-[#111b21] border-r border-slate-200 dark:border-slate-800 select-none">
      {/* Top Header */}
      <div className="h-16 px-4 flex items-center justify-between bg-slate-50 dark:bg-[#202c33] border-b border-slate-200 dark:border-slate-700/60 shrink-0">
        {/* User profile trigger */}
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition text-left cursor-pointer"
        >
          <div className="relative">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm"
              style={{ backgroundColor: currentUser.avatarColor || '#00a884' }}
            >
              {currentUser.username.slice(0, 2).toUpperCase()}
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#25d366] border-2 border-white dark:border-[#202c33]" />
          </div>
          <div className="hidden sm:block">
            <span className="text-sm font-semibold text-slate-900 dark:text-white block leading-tight truncate max-w-[110px]">
              {currentUser.username}
            </span>
            <span className="text-[11px] text-[#00a884] dark:text-[#25d366]">online</span>
          </div>
        </button>

        {/* Action icons */}
        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
          <button
            onClick={onToggleTheme}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="p-2 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition cursor-pointer"
          >
            {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
          </button>

          <button
            onClick={onOpenNewRoom}
            title="Create Room"
            className="p-2 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition cursor-pointer"
          >
            <Plus className="w-5 h-5" />
          </button>

          <button
            onClick={onOpenNewChat}
            title="New Direct Message"
            className="p-2 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition cursor-pointer"
          >
            <MessageSquarePlus className="w-5 h-5" />
          </button>

          <button
            onClick={onOpenSettings}
            title="Circle Settings & Profile"
            className="p-2 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition cursor-pointer"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-2.5 bg-white dark:bg-[#111b21] border-b border-slate-100 dark:border-slate-800/80">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rooms or circle friends..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-100 dark:bg-[#202c33] border-none text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#00a884]"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-[#111b21] border-b border-slate-100 dark:border-slate-800/80 shrink-0">
        <button
          onClick={() => setTab('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition cursor-pointer ${
            tab === 'all'
              ? 'bg-[#00a884] text-white'
              : 'bg-slate-100 dark:bg-[#202c33] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          All Chats
        </button>
        <button
          onClick={() => setTab('rooms')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition cursor-pointer ${
            tab === 'rooms'
              ? 'bg-[#00a884] text-white'
              : 'bg-slate-100 dark:bg-[#202c33] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          Rooms ({rooms.length})
        </button>
        <button
          onClick={() => setTab('dms')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition cursor-pointer ${
            tab === 'dms'
              ? 'bg-[#00a884] text-white'
              : 'bg-slate-100 dark:bg-[#202c33] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          Direct Messages ({otherUsers.length})
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/40">
        
        {/* ROOMS */}
        {(tab === 'all' || tab === 'rooms') && (
          <div>
            {tab === 'all' && (
              <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50/50 dark:bg-[#111b21]">
                Rooms
              </div>
            )}
            {filteredRooms.map((room) => {
              const convKey = `room:${room.id}`;
              const isSelected = activeConversation?.type === 'room' && activeConversation?.id === room.id;
              const unread = unreadCounts[convKey] || 0;
              const lastMsg = latestMessages[convKey];

              return (
                <button
                  key={room.id}
                  onClick={() =>
                    onSelectConversation({
                      type: 'room',
                      id: room.id,
                      title: room.name,
                      subtitle: room.topic || 'Group Room',
                      isDefault: room.isDefault,
                    })
                  }
                  className={`w-full p-3 flex items-center gap-3 transition text-left cursor-pointer ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-[#2a3942]'
                      : 'hover:bg-slate-50 dark:hover:bg-[#202c33]'
                  }`}
                >
                  {/* Room Icon */}
                  <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                    <Hash className="w-6 h-6 text-[#00a884]" />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                        {room.name}
                      </span>
                      <span className="text-[11px] text-slate-400 shrink-0">
                        {formatPreviewTime(lastMsg?.createdAt || room.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate pr-2">
                        {lastMsg ? (
                          <>
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {lastMsg.senderId === currentUser.id ? 'You: ' : `${lastMsg.senderUsername}: `}
                            </span>
                            {lastMsg.isDeleted ? 'This message was deleted' : lastMsg.content || 'Photo'}
                          </>
                        ) : (
                          room.topic || 'No messages yet'
                        )}
                      </p>

                      {unread > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[#25d366] text-white font-bold text-[11px] shrink-0">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* DIRECT MESSAGES */}
        {(tab === 'all' || tab === 'dms') && (
          <div>
            {tab === 'all' && otherUsers.length > 0 && (
              <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50/50 dark:bg-[#111b21]">
                Direct Messages
              </div>
            )}
            {filteredUsers.map((user) => {
              const pair = [currentUser.id, user.id].sort();
              const convKey = `dm:${pair[0]}:${pair[1]}`;
              const isSelected = activeConversation?.type === 'dm' && activeConversation?.id === user.id;
              const unread = unreadCounts[convKey] || 0;
              const lastMsg = latestMessages[convKey];

              return (
                <button
                  key={user.id}
                  onClick={() =>
                    onSelectConversation({
                      type: 'dm',
                      id: user.id,
                      title: user.username,
                      subtitle: user.status === 'online' ? 'online' : `last seen recently`,
                      isOnline: user.status === 'online',
                      lastSeen: user.lastSeen,
                    })
                  }
                  className={`w-full p-3 flex items-center gap-3 transition text-left cursor-pointer ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-[#2a3942]'
                      : 'hover:bg-slate-50 dark:hover:bg-[#202c33]'
                  }`}
                >
                  {/* User Avatar with status dot */}
                  <div className="relative shrink-0">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base shadow-sm"
                      style={{ backgroundColor: user.avatarColor || '#00a884' }}
                    >
                      {user.username.slice(0, 2).toUpperCase()}
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-[#111b21] ${
                        user.status === 'online' ? 'bg-[#25d366]' : 'bg-slate-400'
                      }`}
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                        {user.username}
                      </span>
                      <span className="text-[11px] text-slate-400 shrink-0">
                        {formatPreviewTime(lastMsg?.createdAt || user.lastSeen)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate pr-2">
                        {lastMsg ? (
                          <>
                            {lastMsg.senderId === currentUser.id && (
                              <span className="inline-block mr-1">
                                {lastMsg.status === 'read' ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] inline" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 text-slate-400 inline" />
                                )}
                              </span>
                            )}
                            {lastMsg.isDeleted ? 'This message was deleted' : lastMsg.content || 'Photo'}
                          </>
                        ) : (
                          user.status === 'online' ? 'Online now' : 'Start chatting'
                        )}
                      </p>

                      {unread > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[#25d366] text-white font-bold text-[11px] shrink-0">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {filteredRooms.length === 0 && filteredUsers.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-400">
            No chats found matching "{search}"
          </div>
        )}
      </div>
    </div>
  );
};
