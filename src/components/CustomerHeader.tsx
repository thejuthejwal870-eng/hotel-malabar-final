import React, { memo } from 'react';
import { ShoppingBag, Clock, Phone, LogOut, UtensilsCrossed, Search, User, Menu, X } from 'lucide-react';
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
  const tagline = restaurantProfile?.tagline || 'Authentic Malabar Taste';
  const phone1 = restaurantProfile?.phones?.[0] || '9567562071';
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  return (
    <header className="customer-reference-header sticky top-0 z-40 bg-[#061b10]/95 backdrop-blur-xl border-b border-[#214f34] text-[#fcfaf6] shadow-xl">
      <div className="customer-reference-topbar bg-[#04150c] border-b border-[#17452b] text-[10px] sm:text-[11px] py-1.5 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[#dfe9e2]"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><span className="font-bold text-[#dfb449]">Orders Open</span><span className="text-[#5f7c6b]">•</span><span>Cash on Delivery Only</span></div>
          <a href={`tel:${phone1}`} className="hidden sm:flex items-center gap-1 text-[#dfe9e2] hover:text-[#dfb449]"><Phone className="w-3 h-3 text-[#dfb449]" />{phone1}</a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2.5 flex items-center gap-3">
        <button onClick={() => setMobileNavOpen((v) => !v)} className="lg:hidden w-9 h-9 rounded-lg border border-[#285d40] bg-[#0b2b1a] flex items-center justify-center text-[#dfb64c]" aria-label="Menu">
          {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>

        <div className="flex items-center gap-2.5 min-w-0 shrink-0">
          {restaurantProfile?.logoUrl ? <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg overflow-hidden border border-[#d6ae3a] bg-white shrink-0"><WatermarkedImage src={restaurantProfile.logoUrl} alt={restaurantName} className="w-full h-full" watermarkSize="sm" /></div> : <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-[#d6ae3a] bg-[#f7f3e9] flex items-center justify-center shrink-0"><UtensilsCrossed className="w-5 h-5 text-[#0b4a2a]" /></div>}
          <div className="min-w-0"><div className="font-brand text-sm sm:text-base font-bold tracking-wide truncate">{restaurantName}</div><div className="hidden sm:block text-[8px] uppercase tracking-[0.18em] text-[#d7b24c] truncate">{tagline}</div></div>
        </div>

        <nav className="hidden lg:flex items-center gap-4 ml-5 text-[11px] font-semibold text-[#d8e4dc]">
          <a href="/" className="hover:text-[#dfb64c]">Home</a><a href="/menu.html" className="hover:text-[#dfb64c]">Menu</a><a href="/about.html" className="hover:text-[#dfb64c]">About</a><a href="/contact.html" className="hover:text-[#dfb64c]">Contact</a>
        </nav>

        <div className="hidden md:block flex-1 max-w-xs ml-auto relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#75927f]" />
          <input value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search biryani, shawarma..." className="w-full bg-[#0b2b1a] border border-[#285d40] rounded-lg pl-8 pr-3 py-2 text-[11px] text-[#fcfaf6] placeholder-[#708b7b] focus:outline-none focus:border-[#d6ae3a]" />
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#285d40] bg-[#0b2b1a] text-[11px]"><User className="w-3.5 h-3.5 text-[#d7b24c]" /><span>{user.firstName}</span></div>
          <button id="my-orders-btn" onClick={onOpenOrders} className="relative w-9 h-9 flex items-center justify-center rounded-lg border border-[#285d40] bg-[#0b2b1a] hover:border-[#d6ae3a]" title="My Orders"><Clock className="w-4 h-4 text-[#d7b24c]" />{activeOrdersCount > 0 && <span className="absolute -top-1 -right-1 bg-[#d8b13e] text-[#082013] text-[9px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center">{activeOrdersCount}</span>}</button>
          <button id="view-cart-btn" onClick={onOpenCart} className="relative flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg bg-[#d8b13e] text-[#082013] hover:bg-[#e7c55d] font-bold text-[11px] shadow-md"><ShoppingBag className="w-4 h-4" /><span className="hidden sm:inline">Cart</span>{cartCount > 0 && <span className="bg-[#082013] text-[#e5c35c] text-[9px] px-1.5 py-0.5 rounded-full">{cartCount} • ₹{cartTotal}</span>}</button>
          <button id="customer-logout-btn" onClick={onLogout} className="w-9 h-9 flex items-center justify-center rounded-lg text-[#9ab2a2] hover:text-white hover:bg-[#153d27]" title="Log Out"><LogOut className="w-4 h-4" /></button>
        </div>
      </div>

      {mobileNavOpen && <div className="lg:hidden border-t border-[#17452b] bg-[#071d11] px-4 py-3"><nav className="grid grid-cols-4 gap-2 text-center text-[10px] font-semibold"><a href="/" className="rounded-lg bg-[#0e2b1b] py-2 hover:text-[#dfb64c]">Home</a><a href="/menu.html" className="rounded-lg bg-[#0e2b1b] py-2 hover:text-[#dfb64c]">Menu</a><a href="/about.html" className="rounded-lg bg-[#0e2b1b] py-2 hover:text-[#dfb64c]">About</a><a href="/contact.html" className="rounded-lg bg-[#0e2b1b] py-2 hover:text-[#dfb64c]">Contact</a></nav></div>}

      <div className="md:hidden px-3 pb-2.5"><div className="relative"><Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#75927f]" /><input value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search biryani, shawarma..." className="w-full bg-[#0b2b1a] border border-[#285d40] rounded-lg pl-8 pr-3 py-2 text-[11px] text-[#fcfaf6] placeholder-[#708b7b] focus:outline-none focus:border-[#d6ae3a]" /></div></div>
    </header>
  );
});
