import React, { useState, useEffect, useRef } from 'react';
import { X, Phone, User, ArrowRight, AlertCircle, CheckCircle2, UtensilsCrossed } from 'lucide-react';
import { User as UserType } from '../types';

interface CustomerAuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onAuthSuccess: (token: string, user: UserType) => void;
}

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
}) => {
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const phoneInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMessage(null);
      setTimeout(() => {
        phoneInputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // When 10 digits are typed, quickly check if returning customer to auto-fill names
  useEffect(() => {
    const cleanDigits = phone.replace(/\D/g, '');
    if (cleanDigits.length === 10) {
      let isCurrent = true;
      setLookupLoading(true);
      fetch(`/api/auth/lookup-customer?phone=${cleanDigits}`)
        .then((res) => res.json())
        .then((data) => {
          if (!isCurrent) return;
          if (data?.found) {
            if (data.firstName && !firstName) setFirstName(data.firstName);
            if (data.lastName && !lastName) setLastName(data.lastName);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isCurrent) setLookupLoading(false);
        });
      return () => {
        isCurrent = false;
      };
    }
  }, [phone]);

  if (!isOpen) return null;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow digits and trim to max 10
    const clean = val.replace(/\D/g, '').slice(0, 10);
    setPhone(clean);
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanPhone = phone.replace(/\D/g, '').trim();
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();

    if (!cleanPhone || cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile phone number.');
      return;
    }

    if (!cleanFirstName) {
      setError('Please enter your First Name.');
      return;
    }

    if (!cleanLastName) {
      setError('Please enter your Last Name.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/auth/customer-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          phone: cleanPhone,
          firstName: cleanFirstName,
          lastName: cleanLastName,
        }),
      });

      const responseText = await res.text();
      let data: any = null;
      if (responseText && responseText.trim().length > 0) {
        try {
          data = JSON.parse(responseText);
        } catch {
          data = null;
        }
      }

      if (!res.ok) {
        const errorMsg =
          data?.error ||
          data?.message ||
          (res.statusText ? `Login error (${res.status}): ${res.statusText}` : 'Login failed. Please try again.');
        throw new Error(errorMsg);
      }

      if (!data || !data.token || !data.user) {
        throw new Error('Invalid response from server. Please try again.');
      }

      setSuccessMessage('Welcome! Taking you to the menu...');
      setTimeout(() => {
        onAuthSuccess(data.token, data.user);
      }, 400);
    } catch (err: any) {
      setError(err.message || 'Failed to proceed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-md bg-[#0f2a1b] border border-[#235836] rounded-3xl shadow-2xl text-[#fdfbf7] p-6 sm:p-8 my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#a6bfae] hover:text-[#fdfbf7] p-2 rounded-full hover:bg-[#1a442b] transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 bg-[#163e26] border border-[#cba135]/50 px-3 py-1 rounded-full text-xs font-semibold text-[#dfb64c] uppercase tracking-wider mb-3 shadow-sm">
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>Hotel Malabar Customer Login</span>
          </div>
          <h2 className="font-brand text-2xl sm:text-3xl font-bold text-[#fcfaf6]">
            Welcome to Hotel Malabar
          </h2>
          <p className="text-xs sm:text-sm text-[#9bb5a4] mt-1.5 max-w-xs mx-auto">
            Enter your mobile number and name to explore our authentic Kerala menu and place orders.
          </p>
        </div>

        {/* Notification Banners */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/90 border border-red-800 text-red-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/90 border border-emerald-800 text-emerald-200 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Customer Login Form: Phone Number -> First Name -> Last Name -> Continue -> Menu */}
        <form onSubmit={handleContinue} className="space-y-4">
          {/* 1. Phone Number */}
          <div>
            <label className="block text-xs text-[#c9dcce] mb-1.5 font-semibold">
              Phone Number <span className="text-[#dfb64c]">*</span>
            </label>
            <div className="relative">
              <div className="absolute left-3 top-3 flex items-center gap-1.5 text-[#dfb64c] pointer-events-none">
                <Phone className="w-4 h-4" />
                <span className="text-xs font-bold text-[#c9dcce] pl-0.5 border-r border-[#2d6240] pr-2">
                  +91
                </span>
              </div>
              <input
                ref={phoneInputRef}
                type="tel"
                required
                value={phone}
                onChange={handlePhoneChange}
                placeholder="10-digit mobile number"
                className="w-full bg-[#123620] border border-[#245937] rounded-xl pl-20 pr-3 py-3 text-sm font-medium text-[#fcfaf6] placeholder-[#6d8a76] focus:outline-none focus:border-[#dfb64c] tracking-wide"
                maxLength={10}
              />
              {lookupLoading && (
                <div className="absolute right-3 top-3.5 text-[11px] text-[#dfb64c] animate-pulse">
                  Checking...
                </div>
              )}
            </div>
            <p className="text-[11px] text-[#7da088] mt-1">
              Your registered mobile number for order updates & delivery delivery.
            </p>
          </div>

          {/* 2. First Name */}
          <div>
            <label className="block text-xs text-[#c9dcce] mb-1.5 font-semibold">
              First Name <span className="text-[#dfb64c]">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-3 text-[#799983]" />
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Rahul"
                className="w-full bg-[#123620] border border-[#245937] rounded-xl pl-9 pr-3 py-3 text-sm font-medium text-[#fcfaf6] placeholder-[#6d8a76] focus:outline-none focus:border-[#dfb64c]"
              />
            </div>
          </div>

          {/* 3. Last Name */}
          <div>
            <label className="block text-xs text-[#c9dcce] mb-1.5 font-semibold">
              Last Name <span className="text-[#dfb64c]">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-3 text-[#799983]" />
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Nair"
                className="w-full bg-[#123620] border border-[#245937] rounded-xl pl-9 pr-3 py-3 text-sm font-medium text-[#fcfaf6] placeholder-[#6d8a76] focus:outline-none focus:border-[#dfb64c]"
              />
            </div>
          </div>

          {/* 4. Continue -> Menu Button */}
          <button
            id="customer-login-continue-btn"
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#dfb64c] to-[#cba135] hover:from-[#e7c35d] hover:to-[#d4af37] text-[#0a1f13] font-bold text-base py-3.5 px-4 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer mt-4 disabled:opacity-50"
          >
            <span>{loading ? 'Connecting to Menu...' : 'Continue'}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        {/* Footer info note */}
        <div className="mt-6 pt-4 border-t border-[#1b432a] text-center text-[11px] text-[#8fa897]">
          <span>Cash on Delivery Only • Bommasandra & Surrounding Areas</span>
        </div>
      </div>
    </div>
  );
};

