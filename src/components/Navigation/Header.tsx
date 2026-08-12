import React, { useState } from 'react';
import {
  Zap,
  Bell,
  Settings,
  PlusCircle,
  Flame,
  Server,
  User as UserIcon,
  LogIn,
  LogOut,
  Shield,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

export interface HeaderProps {
  onNewOrder: () => void;
  onTriggerFlashSale: () => void;
  onOpenAuth: () => void;
  isBackendConnected?: boolean;
}

export function Header({ onNewOrder, onTriggerFlashSale, onOpenAuth, isBackendConnected = true }: HeaderProps) {
  const { user, logout, isAuthenticated } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-40 px-6 flex items-center justify-between shadow-xs">
      {/* Brand & Subtitle */}
      <div className="flex items-center space-x-3">
        <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white">
          <Zap className="h-5 w-5 fill-white" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-extrabold text-slate-900 text-lg tracking-tight">OrderFlow</h1>
            <span className="text-[11px] font-semibold font-mono px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
              v1.0 ENTERPRISE
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">Distributed Order Processing Platform</p>
        </div>
      </div>

      {/* Center Environment & Health */}
      <div className="hidden lg:flex items-center space-x-4">
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600 font-medium">
          <Server className="h-3.5 w-3.5 text-slate-500" />
          <span>Environment: <strong className="text-slate-900">LOCAL / DEV</strong></span>
        </div>

        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>System Operational</span>
        </div>
      </div>

      {/* Right Actions & User Profile */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onNewOrder}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm shadow-blue-500/20"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Create Order</span>
        </button>

        <button
          onClick={onTriggerFlashSale}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white transition shadow-sm shadow-amber-500/20"
        >
          <Flame className="h-4 w-4" />
          <span className="hidden sm:inline">Simulate Flash Sale</span>
        </button>

        <div className="h-5 w-[1px] bg-slate-200 mx-1"></div>

        {/* User Auth Controls */}
        {isAuthenticated && user ? (
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-slate-100 transition border border-transparent hover:border-slate-200"
            >
              <div className="h-8 w-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                {user.name ? user.name.substring(0, 2).toUpperCase() : 'US'}
              </div>
              <div className="hidden md:block text-left text-xs">
                <div className="font-bold text-slate-900 leading-tight">{user.name}</div>
                <div className="text-[10px] text-slate-500 font-mono truncate max-w-[120px]">{user.email}</div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-xl p-2 z-50 animate-in fade-in duration-150">
                <div className="p-2 border-b border-slate-100 text-xs">
                  <p className="font-bold text-slate-900">{user.name}</p>
                  <p className="text-[11px] text-slate-500 font-mono truncate">{user.email}</p>
                  <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    <Shield className="h-3 w-3" />
                    ROLE: {user.role.toUpperCase()}
                  </span>
                </div>

                <button
                  onClick={() => { logout(); setIsDropdownOpen(false); }}
                  className="w-full mt-1 flex items-center space-x-2 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg transition"
                >
                  <LogOut className="h-4 w-4 text-rose-600" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold border border-slate-300 hover:bg-slate-50 text-slate-800 transition"
          >
            <LogIn className="h-4 w-4 text-blue-600" />
            <span>Sign In / Register</span>
          </button>
        )}
      </div>
    </header>
  );
}
