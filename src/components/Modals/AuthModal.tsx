import React, { useState } from 'react';
import { X, LogIn, UserPlus, Eye, EyeOff, CheckCircle2, ShieldCheck, Sparkles, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Real-time password validation criteria
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;

  const resetForm = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleFillDemoAdmin = () => {
    setTab('login');
    setEmail('admin@orderflow.io');
    setPassword('OrderFlow2026!');
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (tab === 'login') {
        if (!email || !password) {
          throw new Error('Please enter both email and password.');
        }
        await login(email, password);
        setSuccessMsg('Successfully logged in! Welcome back.');
        setTimeout(() => {
          onClose();
          resetForm();
        }, 600);
      } else {
        if (!name.trim()) {
          throw new Error('Full Name is required.');
        }
        if (!email.trim()) {
          throw new Error('Email address is required.');
        }
        if (!isPasswordValid) {
          throw new Error('Password does not meet all security requirements listed below.');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }

        await register(name, email, password);
        setSuccessMsg('Account created successfully!');
        setTimeout(() => {
          onClose();
          resetForm();
        }, 600);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl p-6 relative border border-slate-200 shadow-2xl space-y-5">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center space-x-2.5 text-slate-900 font-bold text-lg">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3>Enterprise Security Authentication</h3>
              <p className="text-xs text-slate-500 font-normal mt-0.5">OrderFlow Access Control & Auth Protocol</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-slate-100 rounded-xl font-semibold text-xs text-slate-600">
          <button
            type="button"
            onClick={() => { setTab('login'); resetForm(); }}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center space-x-1.5 transition ${
              tab === 'login' ? 'bg-white text-blue-700 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); resetForm(); }}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center space-x-1.5 transition ${
              tab === 'register' ? 'bg-white text-blue-700 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Create Account</span>
          </button>
        </div>

        {/* Demo Fill Quick Pill */}
        {tab === 'login' && (
          <div className="flex items-center justify-between p-2.5 bg-blue-50 rounded-xl border border-blue-200 text-xs">
            <div className="flex items-center space-x-1.5 text-blue-900 font-medium">
              <Sparkles className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <span>Demo Account: <code className="font-mono text-blue-700 font-bold">admin@orderflow.io</code></span>
            </div>
            <button
              type="button"
              onClick={handleFillDemoAdmin}
              className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shadow-xs"
            >
              Autofill
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {tab === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                placeholder="e.g. Sarah Connor"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full input-enterprise px-3 py-2 text-xs"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              placeholder="user@orderflow.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full input-enterprise px-3 py-2 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full input-enterprise px-3 py-2 pr-10 text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {tab === 'register' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full input-enterprise px-3 py-2 text-xs font-mono"
                />
              </div>

              {/* Password Requirements Checklist */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] space-y-1 text-slate-600 font-mono">
                <p className="font-bold text-slate-800 font-sans mb-1">Password Requirements:</p>
                <div className={`flex items-center space-x-1.5 ${hasMinLength ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                  <span>{hasMinLength ? '✓' : '○'}</span>
                  <span>Minimum 8 characters</span>
                </div>
                <div className={`flex items-center space-x-1.5 ${hasUppercase ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                  <span>{hasUppercase ? '✓' : '○'}</span>
                  <span>At least one uppercase letter (A-Z)</span>
                </div>
                <div className={`flex items-center space-x-1.5 ${hasLowercase ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                  <span>{hasLowercase ? '✓' : '○'}</span>
                  <span>At least one lowercase letter (a-z)</span>
                </div>
                <div className={`flex items-center space-x-1.5 ${hasNumber ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                  <span>{hasNumber ? '✓' : '○'}</span>
                  <span>At least one numeric digit (0-9)</span>
                </div>
                <div className={`flex items-center space-x-1.5 ${hasSpecial ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                  <span>{hasSpecial ? '✓' : '○'}</span>
                  <span>At least one special character (!@#$%^&*)</span>
                </div>
              </div>
            </>
          )}

          <div className="pt-2 flex items-center justify-between">
            <div className="flex items-center space-x-1 text-[11px] text-slate-500 font-mono">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
              <span>SHA-256 HMAC Auth</span>
            </div>

            <div className="flex space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold shadow-sm hover:bg-blue-700 transition"
              >
                {isSubmitting ? 'Authenticating...' : tab === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
