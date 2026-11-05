/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  MessageSquare,
  Hash,
  Radio,
  Settings,
  FileText,
  Download,
  LogOut,
  Trash2,
  UserX,
  UserCheck,
  Edit2,
  RefreshCw,
  Search,
  AlertTriangle,
  Lock,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import {
  adminLogin,
  adminLogout,
  getAdminMetrics,
  getAdminUsers,
  kickUser,
  banUser,
  unbanUser,
  renameUser,
  deleteUser,
  getAdminMessages,
  deleteAdminMessage,
  getAdminRooms,
  createAdminRoom,
  renameAdminRoom,
  deleteAdminRoom,
  clearAdminRoom,
  broadcastAnnouncement,
  getAdminSettings,
  updateAdminSettings,
  getAdminLogs,
} from '../../services/api.js';
import type { AdminMetrics, User, Room, Message, AppSettings, ActivityLog } from '../../types/index.js';

export const AdminPortal: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('whatscircle_admin_jwt'));
  const [csrf, setCsrf] = useState<string>(() => localStorage.getItem('whatscircle_admin_csrf') || '');
  const [activeTab, setActiveTab] = useState<'metrics' | 'users' | 'messages' | 'rooms' | 'broadcast' | 'settings' | 'logs' | 'export'>('metrics');

  // Login form state
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Data states
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ text: string; isError?: boolean } | null>(null);

  // Search & Filter inputs
  const [userSearch, setUserSearch] = useState('');
  const [msgSearch, setMsgSearch] = useState('');
  const [msgRoomFilter, setMsgRoomFilter] = useState('');

  // Modals & sub-actions
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUsernameVal, setEditUsernameVal] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomTopic, setNewRoomTopic] = useState('');
  const [broadcastText, setBroadcastText] = useState('');

  // Notify helper
  const notify = (text: string, isError = false) => {
    setActionNotice({ text, isError });
    setTimeout(() => setActionNotice(null), 4000);
  };

  // Handle Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const res = await adminLogin(adminUser, adminPass);
      setToken(res.token);
      setCsrf(res.csrfToken);
      localStorage.setItem('whatscircle_admin_jwt', res.token);
      localStorage.setItem('whatscircle_admin_csrf', res.csrfToken);
    } catch (err: any) {
      if (err.remainingSeconds) {
        setLockoutTime(err.remainingSeconds);
      }
      setLoginError(err.message || 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await adminLogout(token);
      } catch {}
    }
    setToken(null);
    setCsrf('');
    localStorage.removeItem('whatscircle_admin_jwt');
    localStorage.removeItem('whatscircle_admin_csrf');
  };

  // Fetch data on tab change or auth
  const loadActiveData = async () => {
    if (!token) return;
    setIsLoadingData(true);
    try {
      if (activeTab === 'metrics') {
        const m = await getAdminMetrics(token);
        setMetrics(m);
      } else if (activeTab === 'users') {
        const u = await getAdminUsers(token);
        setUsers(u);
      } else if (activeTab === 'messages') {
        const ms = await getAdminMessages(token, msgSearch, msgRoomFilter || undefined);
        setMessages(ms);
      } else if (activeTab === 'rooms') {
        const r = await getAdminRooms(token);
        setRooms(r);
      } else if (activeTab === 'settings') {
        const s = await getAdminSettings(token);
        setSettings(s);
      } else if (activeTab === 'logs') {
        const l = await getAdminLogs(token);
        setLogs(l);
      }
    } catch (err: any) {
      if (err.status === 401 || err.message?.includes('expired') || err.message?.includes('Unauthorized')) {
        handleLogout();
      } else {
        notify(err.message || 'Failed to load data', true);
      }
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadActiveData();
    }
  }, [token, activeTab]);

  // --- Actions ---

  const handleKick = async (user: User) => {
    if (!token) return;
    try {
      await kickUser(token, csrf, user.id, 'Disconnected by admin');
      notify(`Kicked ${user.username}`);
      loadActiveData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const handleBan = async (user: User) => {
    if (!token) return;
    const reason = prompt(`Reason for banning ${user.username}:`, 'Violation of circle rules');
    if (reason === null) return;
    try {
      await banUser(token, csrf, user.id, reason);
      notify(`Banned ${user.username}`);
      loadActiveData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const handleUnban = async (user: User) => {
    if (!token) return;
    try {
      await unbanUser(token, csrf, user.id);
      notify(`Unbanned ${user.username}`);
      loadActiveData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const handleRenameSubmit = async (userId: string) => {
    if (!token || !editUsernameVal.trim()) return;
    try {
      await renameUser(token, csrf, userId, editUsernameVal.trim());
      notify(`Renamed user to ${editUsernameVal.trim()}`);
      setEditingUserId(null);
      loadActiveData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!token) return;
    if (!confirm(`Are you sure you want to permanently delete user "${user.username}"?`)) return;
    try {
      await deleteUser(token, csrf, user.id);
      notify(`Deleted user ${user.username}`);
      loadActiveData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!token) return;
    try {
      await deleteAdminMessage(token, csrf, msgId);
      notify('Message deleted');
      setMessages(prev => prev.filter(m => m.id !== msgId));
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newRoomName.trim()) return;
    try {
      await createAdminRoom(token, csrf, newRoomName.trim(), newRoomTopic.trim() || undefined);
      notify(`Created room #${newRoomName.trim()}`);
      setNewRoomName('');
      setNewRoomTopic('');
      loadActiveData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const handleDeleteRoom = async (roomId: string, roomName: string) => {
    if (!token) return;
    if (!confirm(`Delete room #${roomName} and all its messages?`)) return;
    try {
      await deleteAdminRoom(token, csrf, roomId);
      notify(`Deleted room #${roomName}`);
      loadActiveData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const handleClearRoom = async (roomId: string, roomName: string) => {
    if (!token) return;
    if (!confirm(`Clear all chat history in room #${roomName}?`)) return;
    try {
      await clearAdminRoom(token, csrf, roomId);
      notify(`Cleared messages in #${roomName}`);
      loadActiveData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !broadcastText.trim()) return;
    try {
      await broadcastAnnouncement(token, csrf, broadcastText.trim());
      notify('Broadcast announcement sent to all users!');
      setBroadcastText('');
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !settings) return;
    try {
      const updated = await updateAdminSettings(token, csrf, settings);
      setSettings(updated);
      notify('Circle settings saved successfully');
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  // --- RENDER LOGIN VIEW IF NOT LOGGED IN ---
  if (!token) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-100 p-4">
        <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mb-3">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">Circle Administrator Portal</h2>
            <p className="text-xs text-slate-400 mt-1">
              Restricted area. Rate-limited and server-authenticated.
            </p>
          </div>

          {lockoutTime ? (
            <div className="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs text-center font-medium">
              Too many failed attempts. Locked out for approximately {Math.ceil(lockoutTime / 60)} minutes.
            </div>
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Admin Username
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={adminUser}
                  onChange={(e) => setAdminUser(e.target.value)}
                  placeholder="admin"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Admin Password
                </label>
                <input
                  type="password"
                  required
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 font-semibold text-white text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {isLoggingIn ? 'Authenticating...' : 'Sign In as Admin'}
              </button>

              <div className="pt-2 text-center text-[11px] text-slate-500">
                Default credentials configured in server environment
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // --- RENDER ADMIN DASHBOARD ---
  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-950 text-slate-100 font-sans">
      {/* Top Admin Header */}
      <header className="h-16 px-4 sm:px-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center font-bold">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">WhatsCircle &middot; Admin Console</h1>
            <p className="text-[11px] text-slate-400">Authenticated server session</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadActiveData}
            title="Refresh Data"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} />
          </button>

          <a
            href="/"
            title="Open User Chat"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Chat App</span>
          </a>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-400 text-xs font-semibold transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Global Notice Toast */}
      {actionNotice && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-2.5 rounded-xl shadow-xl text-xs font-medium flex items-center gap-2 animate-fadeIn border ${
            actionNotice.isError
              ? 'bg-red-900/90 text-red-200 border-red-700'
              : 'bg-emerald-900/90 text-emerald-200 border-emerald-700'
          }`}
        >
          {actionNotice.isError ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{actionNotice.text}</span>
        </div>
      )}

      {/* Admin Body */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Admin Navigation Sidebar */}
        <nav className="w-full md:w-56 bg-slate-900/60 border-r border-slate-800 p-2 sm:p-3 flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible shrink-0">
          <button
            onClick={() => setActiveTab('metrics')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition cursor-pointer ${
              activeTab === 'metrics' ? 'bg-red-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition cursor-pointer ${
              activeTab === 'users' ? 'bg-red-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users</span>
          </button>

          <button
            onClick={() => setActiveTab('messages')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition cursor-pointer ${
              activeTab === 'messages' ? 'bg-red-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Moderation</span>
          </button>

          <button
            onClick={() => setActiveTab('rooms')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition cursor-pointer ${
              activeTab === 'rooms' ? 'bg-red-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Hash className="w-4 h-4" />
            <span>Rooms</span>
          </button>

          <button
            onClick={() => setActiveTab('broadcast')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition cursor-pointer ${
              activeTab === 'broadcast' ? 'bg-red-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Broadcast</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition cursor-pointer ${
              activeTab === 'settings' ? 'bg-red-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition cursor-pointer ${
              activeTab === 'logs' ? 'bg-red-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Activity Logs</span>
          </button>

          <button
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition cursor-pointer ${
              activeTab === 'export' ? 'bg-red-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Export Data</span>
          </button>
        </nav>

        {/* Admin Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950">
          
          {/* TAB: METRICS DASHBOARD */}
          {activeTab === 'metrics' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Circle Overview</h2>
                <p className="text-xs text-slate-400 mt-1">Live metrics from your chat circle</p>
              </div>

              {metrics && (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                    <span className="text-xs font-semibold uppercase text-slate-400">Total Users</span>
                    <div className="text-3xl font-bold text-white mt-2 font-mono tabular-nums">
                      {metrics.totalUsers}
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                    <span className="text-xs font-semibold uppercase text-emerald-400">Online Now</span>
                    <div className="text-3xl font-bold text-emerald-400 mt-2 font-mono tabular-nums">
                      {metrics.onlineUsers}
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                    <span className="text-xs font-semibold uppercase text-slate-400">Messages Today</span>
                    <div className="text-3xl font-bold text-white mt-2 font-mono tabular-nums">
                      {metrics.messagesToday}
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                    <span className="text-xs font-semibold uppercase text-slate-400">Active Rooms</span>
                    <div className="text-3xl font-bold text-white mt-2 font-mono tabular-nums">
                      {metrics.activeRooms}
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                    <span className="text-xs font-semibold uppercase text-red-400">Banned Users</span>
                    <div className="text-3xl font-bold text-red-400 mt-2 font-mono tabular-nums">
                      {metrics.bannedUsers}
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                    <span className="text-xs font-semibold uppercase text-slate-400">Total Messages (All-time)</span>
                    <div className="text-3xl font-bold text-white mt-2 font-mono tabular-nums">
                      {metrics.totalMessages}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white">User Management</h2>
                  <p className="text-xs text-slate-400">Manage device sessions, kick, ban, or rename members</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search users..."
                    className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 font-semibold uppercase border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Last Seen</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {users
                      .filter((u) => u.username.toLowerCase().includes(userSearch.toLowerCase()))
                      .map((u) => (
                        <tr key={u.id} className="hover:bg-slate-800/40">
                          <td className="px-4 py-3 flex items-center gap-2.5">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs"
                              style={{ backgroundColor: u.avatarColor || '#00a884' }}
                            >
                              {u.username.slice(0, 2).toUpperCase()}
                            </div>
                            {editingUserId === u.id ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={editUsernameVal}
                                  onChange={(e) => setEditUsernameVal(e.target.value)}
                                  className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-white"
                                />
                                <button
                                  onClick={() => handleRenameSubmit(u.id)}
                                  className="px-2 py-1 rounded bg-emerald-600 text-white text-[11px]"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingUserId(null)}
                                  className="px-2 py-1 rounded bg-slate-700 text-white text-[11px]"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div>
                                <span className="font-semibold text-white">{u.username}</span>
                                {u.isBanned && (
                                  <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-red-950 text-red-400 font-bold border border-red-800">
                                    BANNED
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                u.status === 'online'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {u.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400">
                            {new Date(u.lastSeen).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="px-4 py-3 text-slate-400">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Rename */}
                              <button
                                onClick={() => {
                                  setEditingUserId(u.id);
                                  setEditUsernameVal(u.username);
                                }}
                                title="Rename user"
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Kick (if online) */}
                              {u.status === 'online' && (
                                <button
                                  onClick={() => handleKick(u)}
                                  title="Kick user from session"
                                  className="p-1.5 rounded-lg bg-amber-950 hover:bg-amber-900 text-amber-300"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Ban / Unban */}
                              {u.isBanned ? (
                                <button
                                  onClick={() => handleUnban(u)}
                                  title="Unban user"
                                  className="p-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleBan(u)}
                                  title="Ban user"
                                  className="p-1.5 rounded-lg bg-red-950 hover:bg-red-900 text-red-300"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Delete */}
                              <button
                                onClick={() => handleDeleteUser(u)}
                                title="Permanently delete user"
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-900/60 text-slate-400 hover:text-red-300"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: MESSAGE MODERATION */}
          {activeTab === 'messages' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white">Message Moderation</h2>
                  <p className="text-xs text-slate-400">View and remove any message in any room or direct chat</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    value={msgSearch}
                    onChange={(e) => setMsgSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadActiveData()}
                    placeholder="Search keywords..."
                    className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                  <button
                    onClick={loadActiveData}
                    className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-semibold text-white"
                  >
                    Filter
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
                {messages.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">No messages found.</div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className="p-3.5 flex items-start justify-between gap-4 hover:bg-slate-800/40">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-white">{m.senderUsername}</span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(m.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-mono">
                            {m.roomId ? `#${m.roomId}` : 'DM'}
                          </span>
                          {m.isDeleted && (
                            <span className="text-[10px] text-red-400 font-semibold italic">(Deleted)</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 mt-1 whitespace-pre-wrap break-words">
                          {m.content}
                        </p>
                        {m.mediaUrl && (
                          <div className="mt-2">
                            <img src={m.mediaUrl} alt="attachment" className="h-20 w-auto rounded-lg object-cover" />
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleDeleteMessage(m.id)}
                        title="Delete message"
                        className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-400 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: ROOM MANAGEMENT */}
          {activeTab === 'rooms' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Room Management</h2>
                <p className="text-xs text-slate-400">Create, rename, clear, or delete chat rooms</p>
              </div>

              {/* Create Room Form */}
              <form onSubmit={handleCreateRoom} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">Room Name</label>
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="e.g. Anime, Projects"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">Topic</label>
                  <input
                    type="text"
                    value={newRoomTopic}
                    onChange={(e) => setNewRoomTopic(e.target.value)}
                    placeholder="Room purpose description"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder:text-slate-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newRoomName.trim()}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-semibold text-white whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  Create Room
                </button>
              </form>

              {/* Rooms List */}
              <div className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
                {rooms.map((r) => (
                  <div key={r.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-800/40">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white">#{r.name}</span>
                        {r.isDefault && (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{r.topic || 'No topic configured'}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleClearRoom(r.id, r.name)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
                      >
                        Clear History
                      </button>
                      {!r.isDefault && (
                        <button
                          onClick={() => handleDeleteRoom(r.id, r.name)}
                          className="p-1.5 rounded-lg bg-red-950 hover:bg-red-900 text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: BROADCAST */}
          {activeTab === 'broadcast' && (
            <div className="max-w-xl space-y-4">
              <div>
                <h2 className="text-xl font-bold text-white">System Broadcast</h2>
                <p className="text-xs text-slate-400">Send an urgent alert banner to all online users in your circle</p>
              </div>

              <form onSubmit={handleBroadcast} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                    Announcement Message
                  </label>
                  <textarea
                    rows={4}
                    value={broadcastText}
                    onChange={(e) => setBroadcastText(e.target.value)}
                    placeholder="Attention circle members: Server maintenance scheduled for 10 PM tonight..."
                    className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!broadcastText.trim()}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-semibold text-white transition disabled:opacity-50 cursor-pointer"
                >
                  Dispatch Broadcast to Everyone
                </button>
              </form>
            </div>
          )}

          {/* TAB: SETTINGS */}
          {activeTab === 'settings' && settings && (
            <div className="max-w-xl space-y-4">
              <div>
                <h2 className="text-xl font-bold text-white">Circle Configuration</h2>
                <p className="text-xs text-slate-400">Global rules, upload size, and access restrictions</p>
              </div>

              <form onSubmit={handleSaveSettings} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
                {/* Allow new users */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div>
                    <span className="text-xs font-semibold uppercase text-white block">Allow New User Joins</span>
                    <span className="text-[11px] text-slate-400">Toggle whether new devices can choose a username and enter</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.allowNewUsers}
                    onChange={(e) => setSettings({ ...settings, allowNewUsers: e.target.checked })}
                    className="w-5 h-5 accent-red-600 rounded cursor-pointer"
                  />
                </div>

                {/* Invite Code */}
                <div>
                  <label className="block text-xs font-semibold uppercase text-white mb-1">
                    Optional Circle Invite Code
                  </label>
                  <p className="text-[11px] text-slate-400 mb-1.5">
                    If set, joining users must enter this code along with their username. Leave blank for open circle.
                  </p>
                  <input
                    type="text"
                    value={settings.inviteCode}
                    onChange={(e) => setSettings({ ...settings, inviteCode: e.target.value })}
                    placeholder="e.g. VIP2026 (Leave empty for none)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                  />
                </div>

                {/* Max Upload Size */}
                <div>
                  <label className="block text-xs font-semibold uppercase text-white mb-1">
                    Maximum Image Upload Size (MB)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={settings.maxUploadMb}
                    onChange={(e) => setSettings({ ...settings, maxUploadMb: parseInt(e.target.value, 10) || 5 })}
                    className="w-32 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white font-mono"
                  />
                </div>

                {/* Banned Words */}
                <div>
                  <label className="block text-xs font-semibold uppercase text-white mb-1">
                    Banned Words Filter
                  </label>
                  <p className="text-[11px] text-slate-400 mb-1.5">
                    Comma-separated words that will be automatically censored to ***
                  </p>
                  <textarea
                    rows={3}
                    value={settings.bannedWords.join(', ')}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        bannedWords: e.target.value.split(',').map((w) => w.trim()).filter(Boolean),
                      })
                    }
                    className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-semibold text-white transition cursor-pointer"
                >
                  Save Settings
                </button>
              </form>
            </div>
          )}

          {/* TAB: ACTIVITY LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-white">Activity & Audit Logs</h2>
                <p className="text-xs text-slate-400">Real-time log of user joins, leaves, kicks, bans, and admin operations</p>
              </div>

              <div className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden font-mono text-xs">
                {logs.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">No logs recorded yet.</div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="p-3 flex items-start justify-between gap-4 hover:bg-slate-800/40">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-red-400">{log.action}</span>
                          <span className="text-slate-400">by {log.actorUsername}</span>
                          {log.target && <span className="text-slate-500">target: {log.target}</span>}
                        </div>
                        <p className="text-slate-300 mt-0.5">{log.details}</p>
                      </div>
                      <div className="text-right text-[10px] text-slate-500 shrink-0">
                        <div>{new Date(log.timestamp).toLocaleString()}</div>
                        {log.ip && <div>IP: {log.ip}</div>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: EXPORT DATA */}
          {activeTab === 'export' && (
            <div className="max-w-xl space-y-4">
              <div>
                <h2 className="text-xl font-bold text-white">Export Chat History</h2>
                <p className="text-xs text-slate-400">Download circle messages and conversation records</p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Export complete chat history from all rooms and direct conversations in standard formatted CSV or JSON.
                </p>

                <div className="flex items-center gap-3 pt-2">
                  <a
                    href={`/api/admin/export?format=csv`}
                    download
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center gap-2 transition"
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>Download CSV</span>
                  </a>

                  <a
                    href={`/api/admin/export?format=json`}
                    download
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center gap-2 transition"
                  >
                    <Download className="w-4 h-4 text-amber-400" />
                    <span>Download JSON</span>
                  </a>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
};
