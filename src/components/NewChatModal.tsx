/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Search, UserCheck } from 'lucide-react';
import type { User } from '../types/index.js';

interface NewChatModalProps {
  currentUserId: string;
  users: User[];
  onClose: () => void;
  onSelectUser: (user: User) => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({ currentUserId, users, onClose, onSelectUser }) => {
  const [search, setSearch] = useState('');

  const otherUsers = users.filter(u => u.id !== currentUserId && !u.isBanned);
  const filteredUsers = otherUsers.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111b21] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#00a884]/15 text-[#00a884]">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Start Direct Message</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Select a circle member</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#111b21]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-[#202c33] border border-slate-200 dark:border-slate-700/80 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00a884]"
            />
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-2">
          {filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              {search ? 'No circle members match your search.' : 'No other circle members found yet.'}
            </div>
          ) : (
            filteredUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => {
                  onSelectUser(user);
                  onClose();
                }}
                className="w-full p-3 rounded-xl flex items-center gap-3 hover:bg-slate-100/80 dark:hover:bg-[#202c33] transition text-left cursor-pointer"
              >
                {/* Avatar with status indicator */}
                <div className="relative shrink-0">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-base shadow-sm"
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

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900 dark:text-white truncate text-sm">
                      {user.username}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {user.status === 'online' ? (
                        <span className="text-[#25d366] font-medium">online</span>
                      ) : (
                        'offline'
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    Click to open direct chat
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
