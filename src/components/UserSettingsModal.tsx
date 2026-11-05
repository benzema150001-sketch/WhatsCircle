/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, LogOut, Volume2, VolumeX, Bell, BellOff, Moon, Sun, Smartphone, ShieldCheck, User } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton.js';
import type { User as UserType } from '../types/index.js';

interface UserSettingsModalProps {
  currentUser: UserType;
  isDark: boolean;
  onToggleTheme: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  notificationsEnabled: boolean;
  onRequestNotifications: () => void;
  onLeaveChat: () => void;
  onClose: () => void;
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  currentUser,
  isDark,
  onToggleTheme,
  soundEnabled,
  onToggleSound,
  notificationsEnabled,
  onRequestNotifications,
  onLeaveChat,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111b21] shadow-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Settings & Profile</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-[#202c33] flex items-center gap-3.5 border border-slate-200/70 dark:border-slate-700/60">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm"
            style={{ backgroundColor: currentUser.avatarColor || '#00a884' }}
          >
            {currentUser.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-base text-slate-900 dark:text-white truncate">
              {currentUser.username}
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[#00a884] dark:text-[#25d366]">
              <span className="w-2 h-2 rounded-full bg-[#25d366]" />
              <span>Active on this device</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Device token reserves this username
            </p>
          </div>
        </div>

        {/* Preferences */}
        <div className="mt-5 space-y-2.5">
          {/* Theme */}
          <button
            onClick={onToggleTheme}
            className="w-full p-3 rounded-xl flex items-center justify-between hover:bg-slate-100 dark:hover:bg-[#202c33] transition border border-slate-100 dark:border-slate-800/80 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              {isDark ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Appearance
              </span>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {isDark ? 'Dark Mode' : 'Light Mode'}
            </span>
          </button>

          {/* Sound */}
          <button
            onClick={onToggleSound}
            className="w-full p-3 rounded-xl flex items-center justify-between hover:bg-slate-100 dark:hover:bg-[#202c33] transition border border-slate-100 dark:border-slate-800/80 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              {soundEnabled ? (
                <Volume2 className="w-5 h-5 text-[#00a884]" />
              ) : (
                <VolumeX className="w-5 h-5 text-slate-400" />
              )}
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Audio Chimes
              </span>
            </div>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${
                soundEnabled
                  ? 'bg-[#00a884]/15 text-[#00a884] dark:text-[#25d366]'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
              }`}
            >
              {soundEnabled ? 'Enabled' : 'Muted'}
            </span>
          </button>

          {/* Desktop/Mobile Notification */}
          <button
            onClick={onRequestNotifications}
            className="w-full p-3 rounded-xl flex items-center justify-between hover:bg-slate-100 dark:hover:bg-[#202c33] transition border border-slate-100 dark:border-slate-800/80 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              {notificationsEnabled ? (
                <Bell className="w-5 h-5 text-[#00a884]" />
              ) : (
                <BellOff className="w-5 h-5 text-slate-400" />
              )}
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Browser Notifications
              </span>
            </div>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${
                notificationsEnabled
                  ? 'bg-[#00a884]/15 text-[#00a884] dark:text-[#25d366]'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
              }`}
            >
              {notificationsEnabled ? 'Allowed' : 'Off'}
            </span>
          </button>

          {/* PWA Install */}
          <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-[#00a884]" />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  App Installation
                </span>
              </div>
            </div>
            <PWAInstallButton variant="full" />
          </div>
        </div>

        {/* Leave / Change Name action */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onLeaveChat}
            className="w-full py-2.5 px-4 rounded-xl border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 text-sm font-semibold flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Leave Chat / Change Name</span>
          </button>
          <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 mt-2">
            Clears your session from this device so you can pick a new username.
          </p>
        </div>
      </div>
    </div>
  );
};
