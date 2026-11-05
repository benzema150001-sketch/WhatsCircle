/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { LandingJoin } from './components/LandingJoin.js';
import { ChatLayout } from './components/ChatLayout.js';
import { AdminPortal } from './components/admin/AdminPortal.js';
import { verifySession } from './services/api.js';
import type { User } from './types/index.js';

export default function App() {
  const [isAdminRoute, setIsAdminRoute] = useState(() => {
    return window.location.pathname.startsWith('/admin') || window.location.hash === '#admin';
  });

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isVerifyingSession, setIsVerifyingSession] = useState(true);
  const [banError, setBanError] = useState<string | null>(null);

  // Theme state
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('whatscircle_theme');
    return saved ? saved === 'dark' : true;
  });

  // Apply dark class to document root
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('whatscircle_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('whatscircle_theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  // Monitor location changes (e.g. if user navigates to /admin or changes hash)
  useEffect(() => {
    const handleLocationChange = () => {
      setIsAdminRoute(window.location.pathname.startsWith('/admin') || window.location.hash === '#admin');
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Verify stored session token on initial mount
  useEffect(() => {
    if (isAdminRoute) {
      setIsVerifyingSession(false);
      return;
    }

    const saved = localStorage.getItem('whatscircle_session');
    if (!saved) {
      setIsVerifyingSession(false);
      return;
    }

    try {
      const parsed = JSON.parse(saved);
      if (parsed.sessionToken) {
        verifySession(parsed.sessionToken)
          .then((user) => {
            setCurrentUser(user);
            setSessionToken(parsed.sessionToken);
          })
          .catch((err) => {
            if (err.isBanned) {
              setBanError(err.banReason || 'Your username is banned by the circle administrator.');
            } else {
              localStorage.removeItem('whatscircle_session');
            }
          })
          .finally(() => {
            setIsVerifyingSession(false);
          });
      } else {
        setIsVerifyingSession(false);
      }
    } catch {
      localStorage.removeItem('whatscircle_session');
      setIsVerifyingSession(false);
    }
  }, [isAdminRoute]);

  // If Admin route, render Admin Portal
  if (isAdminRoute) {
    return <AdminPortal />;
  }

  // Session verification loader
  if (isVerifyingSession) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#efeae2] dark:bg-[#0c1317]">
        <div className="w-10 h-10 border-3 border-[#00a884]/20 border-t-[#00a884] rounded-full animate-spin" />
        <p className="mt-4 text-xs font-medium text-slate-500 dark:text-slate-400">
          Connecting to your circle...
        </p>
      </div>
    );
  }

  // Banned screen
  if (banError) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0c1317] text-white p-4">
        <div className="w-full max-w-sm rounded-2xl bg-[#111b21] border border-red-500/30 p-6 text-center shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-red-500/15 text-red-500 flex items-center justify-center mx-auto mb-3 font-bold text-xl">
            !
          </div>
          <h2 className="text-lg font-bold text-white">Access Prohibited</h2>
          <p className="mt-2 text-xs text-red-400 leading-relaxed">
            {banError}
          </p>
          <button
            onClick={() => {
              localStorage.removeItem('whatscircle_session');
              setBanError(null);
              setCurrentUser(null);
              setSessionToken(null);
            }}
            className="mt-5 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition"
          >
            Clear Device Session
          </button>
        </div>
      </div>
    );
  }

  // If session is active and user is authenticated
  if (currentUser && sessionToken) {
    return (
      <ChatLayout
        currentUser={currentUser}
        sessionToken={sessionToken}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onLeaveSession={() => {
          setCurrentUser(null);
          setSessionToken(null);
        }}
      />
    );
  }

  // Otherwise, render Landing Screen
  return (
    <LandingJoin
      onJoinSuccess={(user, token) => {
        setCurrentUser(user);
        setSessionToken(token);
      }}
      isDark={isDark}
      onToggleTheme={toggleTheme}
    />
  );
}
