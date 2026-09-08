import React, { useState } from 'react';
import { X, Lock, Phone, User, Eye, EyeOff, ShieldCheck, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { User as UserType } from '../types';

interface CustomerAuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onAuthSuccess: (token: string, user: UserType) => void;
}

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Form states
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [privacyPin, setPrivacyPin] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!phone || !firstName || !lastName || !password || !privacyPin) {
      setError('Please complete all registration fields.');
      return;
    }

    if (password.length < 8) {
      setError('Main password must be at least 8 characters long.');
      return;
    }

    if (privacyPin.length < 4) {
      setError('Privacy PIN must be at least 4 digits/characters.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          password,
          privacyPin: privacyPin.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      onAuthSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!phone || !password) {
      setError('Please enter your registered phone number and password.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid credentials');
      }

      onAuthSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!phone || !privacyPin || !newPassword) {
      setError('Please provide phone number, your secret Privacy PIN, and new password.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          privacyPin: privacyPin.trim(),
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Recovery failed');
      }

      setSuccessMessage('Password reset successfully! You can now log in.');
      setPassword(newPassword);
      setNewPassword('');
      setTimeout(() => {
        setMode('login');
        setSuccessMessage(null);
      }, 1800);
    } catch (err: any) {
      setError(err.message || 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-md bg-[#0f2a1b] border border-[#235836] rounded-2xl shadow-2xl text-[#fdfbf7] p-6 sm:p-8 my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#a6bfae] hover:text-[#fdfbf7] p-1.5 rounded-full hover:bg-[#1a442b] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-block bg-[#163e26] border border-[#cba135]/50 px-3 py-1 rounded-full text-xs font-semibold text-[#dfb64c] uppercase tracking-wider mb-2">
            Hotel Malabar Customer Portal
          </div>
          <h2 className="font-brand text-2xl sm:text-3xl font-bold text-[#fcfaf6]">
            {mode === 'register' && 'Create Account'}
            {mode === 'login' && 'Customer Login'}
            {mode === 'forgot' && 'Account Recovery'}
          </h2>
          <p className="text-xs text-[#9bb5a4] mt-1">
            {mode === 'register' && 'Register to unlock our complete Kerala menu and order online.'}
            {mode === 'login' && 'Sign in using your registered phone number & password.'}
            {mode === 'forgot' && 'Reset your password securely using your secret Privacy PIN.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-[#091a10] p-1 mb-5 border border-[#1b432a]">
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-[#dfb64c] text-[#0a1f13] shadow'
                : 'text-[#a6bfae] hover:text-[#fdfbf7]'
            }`}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-[#dfb64c] text-[#0a1f13] shadow'
                : 'text-[#a6bfae] hover:text-[#fdfbf7]'
            }`}
          >
            Login
          </button>
        </div>

        {/* Notification Banner */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/80 border border-red-800/80 text-red-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-200 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* REGISTRATION FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#c9dcce] mb-1 font-medium">First Name</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-[#799983]" />
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Rahul"
                    className="w-full bg-[#123620] border border-[#245937] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#fcfaf6] placeholder-[#6d8a76] focus:outline-none focus:border-[#dfb64c]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#c9dcce] mb-1 font-medium">Last Name</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Nair"
                  className="w-full bg-[#123620] border border-[#245937] rounded-xl px-3 py-2.5 text-sm text-[#fcfaf6] placeholder-[#6d8a76] focus:outline-none focus:border-[#dfb64c]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#c9dcce] mb-1 font-medium">Phone Number (Unique ID)</label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-3 text-[#799983]" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full bg-[#123620] border border-[#245937] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#fcfaf6] placeholder-[#6d8a76] focus:outline-none focus:border-[#dfb64c]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-[#c9dcce] font-medium">Strong Password (Min 8 Chars)</label>
                <span className="text-[10px] text-[#8fa897]">Securely Hashed</span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-[#799983]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full bg-[#123620] border border-[#245937] rounded-xl pl-9 pr-10 py-2.5 text-sm text-[#fcfaf6] placeholder-[#6d8a76] focus:outline-none focus:border-[#dfb64c]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-[#799983] hover:text-[#fdfbf7]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-[#dfb64c] font-medium">Separate Privacy PIN / Password</label>
                <span className="text-[10px] text-[#dfb64c]/80">Additional Unlock Layer</span>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3 top-3 text-[#dfb64c]" />
                <input
                  type={showPin ? 'text' : 'password'}
                  required
                  minLength={4}
                  maxLength={8}
                  value={privacyPin}
                  onChange={(e) => setPrivacyPin(e.target.value)}
                  placeholder="4 to 6 digit secret PIN"
                  className="w-full bg-[#123620] border border-[#dfb64c]/50 rounded-xl pl-9 pr-10 py-2.5 text-sm text-[#fcfaf6] placeholder-[#6d8a76] focus:outline-none focus:border-[#dfb64c]"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-2.5 text-[#799983] hover:text-[#fdfbf7]"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-[#8fa897] mt-1">
                Used for instant account recovery & privacy unlock without OTP.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#dfb64c] to-[#cba135] text-[#0a1f13] font-bold py-3 px-4 rounded-xl shadow-lg hover:from-[#e7c35d] hover:to-[#d4af37] transition-all cursor-pointer mt-2 disabled:opacity-50"
            >
              {loading ? 'Creating Account...' : 'Complete Registration & Access Menu'}
            </button>
          </form>
        )}

        {/* LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-[#c9dcce] mb-1 font-medium">Registered Phone Number</label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-3 text-[#799983]" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter phone number"
                  className="w-full bg-[#123620] border border-[#245937] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#fcfaf6] placeholder-[#6d8a76] focus:outline-none focus:border-[#dfb64c]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-[#c9dcce] font-medium">Main Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setError(null);
                  }}
                  className="text-xs text-[#dfb64c] hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-[#799983]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-[#123620] border border-[#245937] rounded-xl pl-9 pr-10 py-2.5 text-sm text-[#fcfaf6] placeholder-[#6d8a76] focus:outline-none focus:border-[#dfb64c]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-[#799983] hover:text-[#fdfbf7]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#dfb64c] to-[#cba135] text-[#0a1f13] font-bold py-3 px-4 rounded-xl shadow-lg hover:from-[#e7c35d] hover:to-[#d4af37] transition-all cursor-pointer disabled:opacity-50 mt-2"
            >
              {loading ? 'Authenticating...' : 'Sign In & View Menu'}
            </button>
          </form>
        )}

        {/* FORGOT PASSWORD FORM (NON-OTP) */}
        {mode === 'forgot' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="p-3 bg-[#11321e] border border-[#204e33] rounded-xl text-xs text-[#c9dcce]">
              <strong>Non-OTP Recovery:</strong> Enter your registered phone number and the separate Privacy PIN you created during registration to set a new password.
            </div>

            <div>
              <label className="block text-xs text-[#c9dcce] mb-1 font-medium">Registered Phone Number</label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-3 text-[#799983]" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full bg-[#123620] border border-[#245937] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#fcfaf6] placeholder-[#6d8a76] focus:outline-none focus:border-[#dfb64c]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#dfb64c] mb-1 font-medium">Your Secret Privacy PIN</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3 top-3 text-[#dfb64c]" />
                <input
                  type={showPin ? 'text' : 'password'}
                  required
                  value={privacyPin}
                  onChange={(e) => setPrivacyPin(e.target.value)}
                  placeholder="Enter your Privacy PIN"
                  className="w-full bg-[#123620] border border-[#dfb64c]/50 rounded-xl pl-9 pr-10 py-2.5 text-sm text-[#fcfaf6] placeholder-[#6d8a76] focus:outline-none focus:border-[#dfb64c]"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-2.5 text-[#799983] hover:text-[#fdfbf7]"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#c9dcce] mb-1 font-medium">New Password (Min 8 chars)</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-[#799983]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new strong password"
                  className="w-full bg-[#123620] border border-[#245937] rounded-xl pl-9 pr-10 py-2.5 text-sm text-[#fcfaf6] placeholder-[#6d8a76] focus:outline-none focus:border-[#dfb64c]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-[#799983] hover:text-[#fdfbf7]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="flex-1 bg-[#123620] text-[#c9dcce] py-2.5 rounded-xl border border-[#245937] text-xs font-semibold hover:bg-[#184428] cursor-pointer"
              >
                Back to Login
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-[#dfb64c] text-[#0a1f13] py-2.5 rounded-xl text-xs font-bold hover:bg-[#ebd06b] cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Reset Password'}
              </button>
            </div>
          </form>
        )}

        {/* Security badge footer */}
        <div className="mt-6 pt-4 border-t border-[#1b432a] flex items-center justify-center gap-2 text-[11px] text-[#8fa897]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#dfb64c]" />
          <span>Bcrypt Encrypted • Strict Non-OTP Architecture</span>
        </div>
      </div>
    </div>
  );
};
