/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search } from 'lucide-react';

export const QUICK_REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉'];

const EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
  {
    name: 'Smileys & Emotion',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😋', '😛',
      '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
      '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌',
      '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧',
      '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓',
      '🧐', '😕', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '😦',
      '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓',
      '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '💀', '☠️', '💩',
    ],
  },
  {
    name: 'Gestures & People',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
      '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
      '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝',
      '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃',
      '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '🫂',
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
    ],
  },
  {
    name: 'Objects & Activities',
    emojis: [
      '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '⚽', '🏀',
      '🏈', '⚾', '🎾', '🏐', '🎮', '🎲', '🎯', '🎸', '🎹', '🎨',
      '📱', '💻', '📷', '💡', '🔥', '✨', '⚡', '⭐', '🌟', '🚀',
      '🍕', '🍔', '🍟', '🌮', '🍣', '🍦', '🍩', '☕', '🍺', '🥂',
    ],
  },
];

interface EmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onClose?: () => void;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelectEmoji, onClose }) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(0);

  const filterEmojis = () => {
    if (!search.trim()) {
      return EMOJI_CATEGORIES[activeCategory].emojis;
    }
    const q = search.trim().toLowerCase();
    // Flat search all
    return EMOJI_CATEGORIES.flatMap(c => c.emojis).filter(e => {
      // Allow searching or display
      return true;
    }).slice(0, 80);
  };

  return (
    <div className="w-72 sm:w-80 h-72 rounded-2xl bg-white dark:bg-[#202c33] shadow-2xl border border-slate-200 dark:border-slate-700/80 flex flex-col overflow-hidden z-50">
      {/* Category Tabs */}
      <div className="flex items-center border-b border-slate-200 dark:border-slate-700/70 px-2 py-1.5 bg-slate-50 dark:bg-[#111b21] gap-1 overflow-x-auto">
        {EMOJI_CATEGORIES.map((cat, idx) => (
          <button
            key={cat.name}
            type="button"
            onClick={() => {
              setActiveCategory(idx);
              setSearch('');
            }}
            className={`px-2.5 py-1 text-xs rounded-lg whitespace-nowrap transition-colors ${
              activeCategory === idx && !search
                ? 'bg-[#00a884] text-white font-medium'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            {cat.name.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-7 gap-1">
        {filterEmojis().map((emoji, idx) => (
          <button
            key={`${emoji}-${idx}`}
            type="button"
            onClick={() => {
              onSelectEmoji(emoji);
              if (onClose) onClose();
            }}
            className="w-8 h-8 flex items-center justify-center text-xl rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 active:scale-90 transition-transform cursor-pointer"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
