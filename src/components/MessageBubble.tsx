/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Check, CheckCheck, CornerDownLeft, Trash2, Smile, MoreVertical, X } from 'lucide-react';
import { QUICK_REACTION_EMOJIS, EmojiPicker } from './EmojiPicker.js';
import type { Message, MessageReaction } from '../types/index.js';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  isGroup: boolean;
  onReply: (message: Message) => void;
  onDelete: (messageId: string) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  senderAvatarColor?: string;
  onImageClick?: (url: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  isGroup,
  onReply,
  onDelete,
  onToggleReaction,
  senderAvatarColor = '#00a884',
  onImageClick,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showQuickReactions, setShowQuickReactions] = useState(false);
  const [showFullEmojiPicker, setShowFullEmojiPicker] = useState(false);

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Group reactions by emoji
  const groupedReactions: { emoji: string; count: number; users: string[] }[] = [];
  if (message.reactions && message.reactions.length > 0) {
    const map = new Map<string, { count: number; users: string[] }>();
    for (const rx of message.reactions) {
      if (!map.has(rx.emoji)) {
        map.set(rx.emoji, { count: 0, users: [] });
      }
      const item = map.get(rx.emoji)!;
      item.count += 1;
      item.users.push(rx.username);
    }
    map.forEach((val, emoji) => {
      groupedReactions.push({ emoji, count: val.count, users: val.users });
    });
  }

  return (
    <div
      className={`group relative flex flex-col mb-1.5 px-2 ${
        isOwn ? 'items-end' : 'items-start'
      }`}
    >
      {/* Floating Action Strip on Hover */}
      {!message.isDeleted && (
        <div
          className={`absolute top-0 z-20 hidden group-hover:flex items-center gap-1 p-1 rounded-full bg-white dark:bg-[#202c33] shadow-md border border-slate-200 dark:border-slate-700/80 -translate-y-1/2 ${
            isOwn ? 'right-2' : 'left-2'
          }`}
        >
          {/* Quick Reactions */}
          <div className="flex items-center gap-0.5 px-1">
            {QUICK_REACTION_EMOJIS.slice(0, 5).map((emoji) => (
              <button
                key={emoji}
                onClick={() => onToggleReaction(message.id, emoji)}
                className="w-6 h-6 flex items-center justify-center text-sm rounded-full hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>

          <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Reply Button */}
          <button
            onClick={() => onReply(message)}
            title="Reply"
            className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
          >
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>

          {/* Delete Button (Own message only) */}
          {isOwn && (
            <button
              onClick={() => onDelete(message.id)}
              title="Delete message"
              className="p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-500 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* More Emojis Picker Button */}
          <div className="relative">
            <button
              onClick={() => setShowFullEmojiPicker(prev => !prev)}
              title="Add reaction"
              className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>

            {showFullEmojiPicker && (
              <div className="absolute right-0 bottom-full mb-2 z-50">
                <EmojiPicker
                  onSelectEmoji={(emoji) => {
                    onToggleReaction(message.id, emoji);
                    setShowFullEmojiPicker(false);
                  }}
                  onClose={() => setShowFullEmojiPicker(false)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Message Bubble Container */}
      <div
        className={`relative max-w-[85%] sm:max-w-[70%] rounded-2xl p-2.5 sm:px-3 sm:py-2 text-sm shadow-sm transition-all ${
          message.isDeleted
            ? 'italic text-slate-400 bg-slate-100 dark:bg-[#182229] border border-slate-200/50 dark:border-slate-800/50'
            : isOwn
            ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-900 dark:text-slate-100 rounded-tr-xs'
            : 'bg-white dark:bg-[#202c33] text-slate-900 dark:text-slate-100 rounded-tl-xs'
        }`}
      >
        {/* Group Sender Name */}
        {!isOwn && isGroup && !message.isDeleted && (
          <div
            className="text-xs font-semibold mb-1 tracking-tight truncate"
            style={{ color: senderAvatarColor }}
          >
            {message.senderUsername}
          </div>
        )}

        {/* Reply Quote Preview */}
        {message.replyToContent && !message.isDeleted && (
          <div className="mb-1.5 p-2 rounded-lg bg-black/5 dark:bg-black/20 border-l-4 border-[#00a884] text-xs">
            <span className="font-semibold text-[#00a884] dark:text-[#25d366] block truncate">
              {message.replyToSender || 'Message'}
            </span>
            <p className="line-clamp-2 text-slate-600 dark:text-slate-300 mt-0.5">
              {message.replyToContent}
            </p>
          </div>
        )}

        {/* Media (Image) */}
        {message.mediaUrl && !message.isDeleted && (
          <div className="mb-1.5 overflow-hidden rounded-xl bg-black/10 max-h-72">
            <img
              src={message.mediaUrl}
              alt="Shared media"
              onClick={() => onImageClick && onImageClick(message.mediaUrl!)}
              className="w-full h-auto max-h-72 object-cover rounded-xl cursor-pointer hover:opacity-95 transition"
              loading="lazy"
            />
          </div>
        )}

        {/* Text Content */}
        <div className="leading-relaxed whitespace-pre-wrap break-words pr-12">
          {message.content}
        </div>

        {/* Timestamp & Status Ticks aligned bottom-right */}
        <div className="flex items-center justify-end gap-1 float-right -mt-2.5 ml-2 pt-1 text-[10px] text-slate-500 dark:text-slate-400 select-none">
          <span>{formatTime(message.createdAt)}</span>
          {isOwn && !message.isDeleted && (
            <span className="flex items-center">
              {message.status === 'sent' && (
                <Check className="w-3.5 h-3.5 text-slate-400" />
              )}
              {message.status === 'delivered' && (
                <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
              )}
              {message.status === 'read' && (
                <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
              )}
            </span>
          )}
        </div>
      </div>

      {/* Reaction Badges */}
      {groupedReactions.length > 0 && !message.isDeleted && (
        <div
          className={`flex flex-wrap items-center gap-1 -mt-2 z-10 ${
            isOwn ? 'mr-2 justify-end' : 'ml-2 justify-start'
          }`}
        >
          {groupedReactions.map((rx) => (
            <button
              key={rx.emoji}
              onClick={() => onToggleReaction(message.id, rx.emoji)}
              title={rx.users.join(', ')}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white dark:bg-[#1f2c34] shadow-sm border border-slate-200 dark:border-slate-700/80 text-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <span>{rx.emoji}</span>
              {rx.count > 1 && (
                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                  {rx.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
