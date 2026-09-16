import React, { memo } from 'react';
import { ShoppingBag, Clock, Phone, LogOut, UtensilsCrossed, Search, User } from 'lucide-react';
import { User as UserType, RestaurantProfile } from '../types';
import { WatermarkedImage } from './WatermarkedImage';

interface CustomerHeaderProps {
  user: UserType;
  restaurantProfile?: RestaurantProfile | null;
  cartCount: number;
  cartTotal: number;
  activeOrdersCount: number;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  onOpenCart: () => void;
  onOpenOrders: () => void;
  onLogout: () => void;
}

export const CustomerHeader: React.FC<CustomerHeaderProps> = memo(({ user, restaurantProfile, cartCount, cartTotal, activeOrdersCount, searchQuery, onSearchChange, onOpenCart, onOpenOrders, onLogout }) => {
  const restaurantName = restaurantProfile?.name || 'HOTEL MALABAR';
  const tagline = restaurantProfile?.tagline || 'Taste of Kerala';
  const phone1 = restaurantProfile?.phones?.[0] || '9567562071';
  const phone2 = restaurantProfile?.phones?.[1] || '8904634717';

  return (
    <header className="sticky top-0 z-40 bg-[#061b10]/95 backdrop-blur-xl border-b border-[#214f34] text-[#fcfaf6] shadow-xl">
      <div className="bg-[#04150c] border-b border-[#17452b] text-[11px] sm:text-xs py-2 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[#e8dfcd]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-[#dfb449]">Orders Open</span>
            <span className="text-[#6d8c77]">|</span>
            <span>Cash on Delivery Only</span>
          </div>
          <a href={`tel:${phone1}`} className="flex items-center gap-1.5 text-[#e8dfcd] hover:text-[#dfb449]">
            <Phone className="w-3.5 h-3.5 text-[#dfb449]" /> {phone1}
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 mr-auto min-w-0">
          {restaurantProfile?.logoUrl ? (
            <div className="w-11 h-11 rounded-xl overflow-hidden border border-[#d6ae3a] bg-white shrink-0">
              <WatermarkedImage src={restaurantProfile.logoUrl} alt={restaurantName} className="w-full h-full" watermarkSize="sm" />
            </div>
          ) : (
            <div className="w-11 h-11 rounded-xl border border-[#d6ae3a] bg-[#f7f3e9] flex items-center justify-center shrink-0"><UtensilsCrossed className="w-6 h-6 text-[#0b4a2a]" /></div>
          )}
          <div className="min-w-0">
            <div className="font-brand text-lg sm:text-xl font-bold tracking-wide truncate">{restaurantName}</div>
            <div className="text-[9px] uppercase tracking-[0.22em] text-[#d7b24c] truncate max-w-[220px]">{tagline}</div>
          </div>
        </div>

        <div className="hidden lg:block flex-1 max-w-sm mx-2 relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#75927f]" />
          <input value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search biryani, porotta, seafood..." className="w-full bg-[#0b2b1a] border border-[#285d40] rounded-xl pl-9 pr-3 py-2 text-xs text-[#fcfaf6] placeholder-[#708b7b] focus:outline-none focus:border-[#d6ae3a]" />
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#285d40] bg-[#0b2b1a] text-xs">
            <User className="w-4 h-4 text-[#d7b24c]" /> <span>{user.firstName}</span>
          </div>
          <button id="my-orders-btn" onClick={onOpenOrders} className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#285d40] bg-[#0b2b1a] hover:border-[#d6ae3a] text-xs font-semibold transition-all">
            <Clock className="w-4 h-4 text-[#d7b24c]" /><span className="hidden sm:inline">My Orders</span>
            {activeOrdersCount > 0 && <span className="bg-[#d8b13e] text-[#082013] text-[10px] font-bold px-1.5 py-0.5 rounded-full">{activeOrdersCount}</span>}
          </button>
          <button id="view-cart-btn" onClick={onOpenCart} className="relative flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#d8b13e] text-[#082013] hover:bg-[#e7c55d] font-bold text-xs sm:text-sm shadow-md transition-all">
            <ShoppingBag className="w-4 h-4" /><span className="hidden sm:inline">Cart</span>
            {cartCount > 0 && <span className="bg-[#082013] text-[#e5c35c] text-[10px] px-1.5 py-0.5 rounded-full">{cartCount} • ₹{cartTotal}</span>}
          </button>
          <button id="customer-logout-btn" onClick={onLogout} className="p-2 rounded-xl text-[#9ab2a2] hover:text-white hover:bg-[#153d27] transition-colors" title="Log Out"><LogOut className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="lg:hidden px-4 pb-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#75927f]" />
          <input value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search biryani, porotta, seafood..." className="w-full bg-[#0b2b1a] border border-[#285d40] rounded-xl pl-9 pr-3 py-2 text-xs text-[#fcfaf6] placeholder-[#708b7b] focus:outline-none focus:border-[#d6ae3a]" />
        </div>
      </div>
    </header>
  );
});
