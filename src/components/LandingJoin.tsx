/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { MessageSquare, ArrowRight, ShieldCheck, Users, Sparkles, Moon, Sun, Lock } from 'lucide-react';
import { joinChat, getPublicSettings } from '../services/api.js';
import type { User } from '../types/index.js';

interface LandingJoinProps {
  onJoinSuccess: (user: User, sessionToken: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export const LandingJoin: React.FC<LandingJoinProps> = ({ onJoinSuccess, isDark, onToggleTheme }) => {
  const [username, setUsername] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [hasInviteCode, setHasInviteCode] = useState(false);
  const [allowNewUsers, setAllowNewUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    getPublicSettings()
      .then(settings => {
        setHasInviteCode(settings.hasInviteCode);
        setAllowNewUsers(settings.allowNewUsers);
      })
      .catch(() => {});
  }, []);

  const validateUsername = (name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return 'Please choose a username.';
    if (trimmed.length < 3) return 'Username must be at least 3 characters.';
    if (trimmed.length > 20) return 'Username cannot exceed 20 characters.';
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      return 'Username can only contain letters, numbers, and underscores.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validateUsername(username);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!allowNewUsers) {
      setError('New user registrations are currently closed by the circle administrator.');
      return;
    }

    setIsLoading(true);
    try {
      const data = await joinChat(username.trim(), inviteCode ? inviteCode.trim() : undefined);
      // Persist session
      localStorage.setItem('whatscircle_session', JSON.stringify({
        sessionToken: data.sessionToken,
        userId: data.user.id,
        username: data.user.username,
      }));
      onJoinSuccess(data.user, data.sessionToken);
    } catch (err: any) {
      setError(err.message || 'Could not join chat. Please try another username.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between bg-[#efeae2] dark:bg-[#0c1317] text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {/* Top Banner Accent */}
      <div className="h-28 sm:h-36 w-full bg-[#00a884] dark:bg-[#075e54] absolute top-0 left-0 right-0" />

      {/* Theme Toggle in Top Right */}
      <div className="relative z-10 flex justify-end p-4 sm:p-6">
        <button
          onClick={onToggleTheme}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition-all shadow-sm"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      {/* Main Join Card */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-white dark:bg-[#111b21] rounded-2xl sm:rounded-3xl shadow-xl dark:shadow-2xl border border-slate-200 dark:border-slate-800/80 p-6 sm:p-8">
          
          {/* Brand Header */}
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-[#00a884] to-[#25d366] flex items-center justify-center text-white shadow-lg shadow-[#00a884]/25 mb-4">
              <MessageSquare className="w-9 h-9 sm:w-11 sm:h-11" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              WhatsCircle
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Private Real-Time Chat for Your Circle
            </p>
          </div>

          {/* Registration Status Notice */}
          {!allowNewUsers && (
            <div className="mt-5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs text-center font-medium">
              Circle memberships are currently closed by the administrator.
            </div>
          )}

          {/* Join Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="username" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Choose a Username
              </label>
              <div className="relative">
                <input
                  id="username"
                  type="text"
                  autoFocus
                  disabled={!allowNewUsers || isLoading}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. alex_rivera"
                  maxLength={20}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#202c33] border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00a884] text-sm sm:text-base transition"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                3–20 characters. Letters, numbers, and underscores only.
              </p>
            </div>

            {/* Optional Invite Code if configured on server */}
            {hasInviteCode && (
              <div>
                <label htmlFor="inviteCode" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#00a884]" />
                  Circle Invite Code
                </label>
                <input
                  id="inviteCode"
                  type="password"
                  disabled={!allowNewUsers || isLoading}
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Enter invite code"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202c33] border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00a884] text-sm transition"
                />
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-medium animate-fadeIn">
                {error}
              </div>
            )}

            {/* Submit CTA */}
            <button
              type="submit"
              disabled={!allowNewUsers || isLoading || !username.trim()}
              className="w-full py-3.5 px-4 rounded-xl bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-50 disabled:pointer-events-none text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-[#00a884]/30 active:scale-[0.98] transition-all cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Join Chat</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Features Highlights */}
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-3 gap-2 text-center">
            <div className="flex flex-col items-center">
              <ShieldCheck className="w-5 h-5 text-[#00a884] mb-1" />
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">No Passwords</span>
            </div>
            <div className="flex flex-col items-center">
              <Users className="w-5 h-5 text-[#00a884] mb-1" />
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Rooms & DMs</span>
            </div>
            <div className="flex flex-col items-center">
              <Sparkles className="w-5 h-5 text-[#00a884] mb-1" />
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Real-Time</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 py-4 text-center text-xs text-slate-500 dark:text-slate-500">
        WhatsCircle &copy; 2026 &middot; Private Circle Communication
      </div>
    </div>
  );
};
