/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Paperclip,
  Smile,
  Send,
  X,
  ChevronDown,
  Hash,
  Image as ImageIcon,
  AlertCircle,
} from 'lucide-react';
import { MessageBubble } from './MessageBubble.js';
import { EmojiPicker } from './EmojiPicker.js';
import { uploadImage } from '../services/api.js';
import type { Message, ActiveConversation, User } from '../types/index.js';

interface ChatAreaProps {
  currentUser: User;
  sessionToken: string;
  conversation: ActiveConversation;
  messages: Message[];
  onSendMessage: (content: string, mediaUrl?: string, replyTo?: Message) => void;
  onDeleteMessage: (messageId: string) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onBackMobile: () => void;
  isTypingUser?: string | null;
  onSendTyping: (isTyping: boolean) => void;
  userMap: Map<string, User>;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  currentUser,
  sessionToken,
  conversation,
  messages,
  onSendMessage,
  onDeleteMessage,
  onToggleReaction,
  onBackMobile,
  isTypingUser,
  onSendTyping,
  userMap,
}) => {
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll on new message
  useEffect(() => {
    if (!showScrollBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTypingUser, showScrollBottom]);

  // Handle scroll detection
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 150;
    setShowScrollBottom(!isAtBottom);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBottom(false);
  };

  // Handle typing debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    onSendTyping(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onSendTyping(false);
    }, 1500);
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendMessage(trimmed, undefined, replyingTo || undefined);
    setText('');
    setReplyingTo(null);
    setShowEmojiPicker(false);
    onSendTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle Image Upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (client side pre-check: 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image exceeds the maximum upload limit of 5 MB.');
      setTimeout(() => setUploadError(null), 4000);
      return;
    }

    // Validate type
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setUploadError('Only PNG, JPG, GIF, and WEBP images are supported.');
      setTimeout(() => setUploadError(null), 4000);
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        const uploadResult = await uploadImage(sessionToken, dataUrl, file.name, file.type);
        onSendMessage('', uploadResult.url, replyingTo || undefined);
        setReplyingTo(null);
      } catch (err: any) {
        setUploadError(err.message || 'Image upload failed.');
        setTimeout(() => setUploadError(null), 4000);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setUploadError('Failed to read image file.');
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  // Group messages by date
  const renderMessageStream = () => {
    let lastDateStr = '';
    return messages.map((msg) => {
      const msgDate = new Date(msg.createdAt).toDateString();
      const showDateDivider = msgDate !== lastDateStr;
      lastDateStr = msgDate;

      const sender = userMap.get(msg.senderId);
      const isOwn = msg.senderId === currentUser.id;

      return (
        <React.Fragment key={msg.id}>
          {showDateDivider && (
            <div className="flex justify-center my-3">
              <span className="px-3 py-1 rounded-lg bg-white/80 dark:bg-[#182229]/90 shadow-sm text-[11px] font-medium text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-800">
                {new Date(msg.createdAt).toLocaleDateString([], {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          )}
          <MessageBubble
            message={msg}
            isOwn={isOwn}
            isGroup={conversation.type === 'room'}
            onReply={(m) => setReplyingTo(m)}
            onDelete={onDeleteMessage}
            onToggleReaction={onToggleReaction}
            senderAvatarColor={sender?.avatarColor || '#00a884'}
            onImageClick={(url) => setLightboxUrl(url)}
          />
        </React.Fragment>
      );
    });
  };

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-[#111b21] overflow-hidden relative">
      
      {/* Top Header */}
      <div className="h-16 px-4 flex items-center justify-between bg-slate-50 dark:bg-[#202c33] border-b border-slate-200 dark:border-slate-700/60 shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          {/* Back button on mobile */}
          <button
            onClick={onBackMobile}
            className="md:hidden p-1.5 -ml-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Conversation Avatar */}
          <div className="relative shrink-0">
            {conversation.type === 'room' ? (
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300">
                <Hash className="w-5 h-5 text-[#00a884]" />
              </div>
            ) : (
              <div className="relative">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{
                    backgroundColor: userMap.get(conversation.id)?.avatarColor || '#00a884',
                  }}
                >
                  {conversation.title.slice(0, 2).toUpperCase()}
                </div>
                <span
                  className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#202c33] ${
                    conversation.isOnline ? 'bg-[#25d366]' : 'bg-slate-400'
                  }`}
                />
              </div>
            )}
          </div>

          {/* Title and subtitle */}
          <div className="min-w-0">
            <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white truncate leading-tight">
              {conversation.title}
            </h3>
            <p className="text-xs truncate mt-0.5">
              {isTypingUser ? (
                <span className="text-[#00a884] dark:text-[#25d366] font-medium animate-pulse">
                  {conversation.type === 'room' ? `${isTypingUser} is typing...` : 'typing...'}
                </span>
              ) : conversation.type === 'dm' ? (
                conversation.isOnline ? (
                  <span className="text-[#25d366]">online</span>
                ) : (
                  <span className="text-slate-400">offline</span>
                )
              ) : (
                <span className="text-slate-500 dark:text-slate-400">
                  {conversation.subtitle || 'Private Circle Room'}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Main Messages Area with subtle WhatsApp doodle texture */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 whatsapp-chat-bg-light dark:whatsapp-chat-bg-dark relative"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 dark:text-slate-400">
            <div className="w-16 h-16 rounded-2xl bg-white/70 dark:bg-[#182229]/80 flex items-center justify-center shadow-sm mb-3">
              <Hash className="w-8 h-8 text-[#00a884]" />
            </div>
            <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-base">
              {conversation.title}
            </h4>
            <p className="text-xs max-w-xs mt-1 text-slate-500">
              {conversation.subtitle || 'Start the conversation! Messages are delivered in real time.'}
            </p>
          </div>
        ) : (
          renderMessageStream()
        )}

        {/* Typing indicator bubble */}
        {isTypingUser && (
          <div className="flex items-center gap-1.5 p-2 rounded-2xl bg-white dark:bg-[#202c33] shadow-sm w-fit my-1.5 text-xs text-slate-500 dark:text-slate-400 animate-fadeIn">
            <span className="font-medium text-[#00a884]">{isTypingUser}</span>
            <div className="flex items-center gap-1 ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-bounce" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute right-6 bottom-20 z-20 p-2.5 rounded-full bg-white dark:bg-[#202c33] text-slate-600 dark:text-slate-300 shadow-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition cursor-pointer"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      )}

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="px-4 py-2 bg-red-500/15 border-t border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{uploadError}</span>
          </div>
          <button onClick={() => setUploadError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Replying-to Preview Bar */}
      {replyingTo && (
        <div className="px-4 py-2 bg-slate-100 dark:bg-[#182229] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="border-l-4 border-[#00a884] pl-2 text-xs min-w-0">
            <span className="font-semibold text-[#00a884] block truncate">
              Replying to {replyingTo.senderUsername}
            </span>
            <p className="text-slate-600 dark:text-slate-400 truncate">
              {replyingTo.content || (replyingTo.mediaUrl ? 'Photo' : 'Message')}
            </p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Message Input Bar */}
      <div className="p-2 sm:p-3 bg-slate-50 dark:bg-[#202c33] border-t border-slate-200 dark:border-slate-700/60 flex items-center gap-1.5 sm:gap-2 shrink-0 relative">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
          className="hidden"
        />

        {/* Emoji Toggle Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className={`p-2 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-700/60 text-slate-500 dark:text-slate-400 transition cursor-pointer ${
              showEmojiPicker ? 'text-[#00a884]' : ''
            }`}
          >
            <Smile className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {showEmojiPicker && (
            <div className="absolute left-0 bottom-full mb-3 z-50">
              <EmojiPicker
                onSelectEmoji={(emoji) => setText((prev) => prev + emoji)}
                onClose={() => setShowEmojiPicker(false)}
              />
            </div>
          )}
        </div>

        {/* Attachment Button */}
        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          title="Share an image (Max 5MB)"
          className="p-2 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-700/60 text-slate-500 dark:text-slate-400 transition disabled:opacity-50 cursor-pointer"
        >
          {isUploading ? (
            <div className="w-5 h-5 border-2 border-slate-400 border-t-[#00a884] rounded-full animate-spin" />
          ) : (
            <Paperclip className="w-5 h-5 sm:w-6 sm:h-6" />
          )}
        </button>

        {/* Text Input */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={text}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="w-full py-2.5 px-4 rounded-xl bg-white dark:bg-[#2a3942] border-none text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#00a884]"
          />
        </div>

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim()}
          className="p-2.5 rounded-full bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-40 disabled:hover:bg-[#00a884] text-white transition active:scale-95 shadow-sm cursor-pointer"
        >
          <Send className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>

      {/* Image Lightbox Modal */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 cursor-pointer"
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 text-white hover:bg-white/30"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="Expanded view"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
