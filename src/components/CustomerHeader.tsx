import React from 'react';
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

export const CustomerHeader: React.FC<CustomerHeaderProps> = ({
  user,
  restaurantProfile,
  cartCount,
  cartTotal,
  activeOrdersCount,
  searchQuery,
  onSearchChange,
  onOpenCart,
  onOpenOrders,
  onLogout,
}) => {
  const restaurantName = restaurantProfile?.name || 'HOTEL MALABAR';
  const tagline = restaurantProfile?.tagline || 'Authentic Kerala Cuisine';
  const phone1 = restaurantProfile?.phones?.[0] || '9567562071';
  const phone2 = restaurantProfile?.phones?.[1] || '8904634717';

  return (
    <header className="sticky top-0 z-40 bg-[#0d2819]/95 backdrop-blur-md border-b border-[#1f4a2e] text-[#fcfaf6] shadow-lg">
      {/* Top Banner with Delivery & Hotlines */}
      <div className="bg-[#081a10] border-b border-[#173a24] text-[11px] sm:text-xs text-[#c9dcce] py-1.5 px-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-[#dfb64c]">{restaurantName} Live Delivery:</span>
            <span>First 2 km FREE • Cash on Delivery Only</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-[#8aa593]">Orders & Help:</span>
            <a href={`tel:${phone1}`} className="hover:text-[#dfb64c] flex items-center gap-1 font-mono">
              <Phone className="w-3 h-3 text-[#dfb64c]" />
              <span>{phone1}</span>
            </a>
            <a href={`tel:${phone2}`} className="hidden md:flex hover:text-[#dfb64c] items-center gap-1 font-mono">
              <Phone className="w-3 h-3 text-[#dfb64c]" />
              <span>{phone2}</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          {restaurantProfile?.logoUrl ? (
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden border border-[#cba135] shadow-md bg-[#081a10] flex-shrink-0">
              <WatermarkedImage
                src={restaurantProfile.logoUrl}
                alt={restaurantName}
                className="w-full h-full"
                watermarkSize="sm"
              />
            </div>
          ) : (
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-[#1b472e] to-[#0a1f13] border border-[#cba135] shadow-md flex flex-col items-center justify-center p-1 relative flex-shrink-0">
              <UtensilsCrossed className="w-5 h-5 text-[#dfb64c]" />
              <span className="font-brand text-[7px] text-[#e8dcb8] font-bold uppercase">Malabar</span>
            </div>
          )}
          <div>
            <span className="font-brand text-xl sm:text-2xl font-bold tracking-wide text-[#fdfbf7] block leading-tight">
              {restaurantName}
            </span>
            <span className="text-[10px] sm:text-xs text-[#dfb64c] font-medium tracking-wider uppercase block truncate max-w-[260px] sm:max-w-none">
              {tagline}
            </span>
          </div>
        </div>

        {/* Search Bar (Desktop) */}
        <div className="hidden md:flex flex-1 max-w-xs mx-4 relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#799983]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search biryani, porotta, seafood..."
            className="w-full bg-[#123620] border border-[#245937] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#fcfaf6] placeholder-[#6d8a76] focus:outline-none focus:border-[#dfb64c]"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* User badge */}
          <div className="hidden lg:flex items-center gap-2 bg-[#123620] border border-[#245937] px-2.5 py-1.5 rounded-xl text-xs text-[#e0d8c7]">
            <div className="w-6 h-6 rounded-full bg-[#1c4d2f] flex items-center justify-center text-[#dfb64c]">
              <User className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="font-semibold leading-tight">{user.firstName}</div>
              <div className="text-[10px] text-[#8fa897] font-mono leading-none">{user.phone}</div>
            </div>
          </div>

          {/* My Orders Button */}
          <button
            id="my-orders-btn"
            onClick={onOpenOrders}
            className="relative flex items-center gap-1.5 bg-[#123620] hover:bg-[#184428] border border-[#245937] hover:border-[#dfb64c]/60 text-xs text-[#fdfbf7] px-3 py-2 rounded-xl transition-all cursor-pointer"
            title="My Orders"
          >
            <Clock className="w-4 h-4 text-[#dfb64c]" />
            <span className="hidden sm:inline font-medium">My Orders</span>
            {activeOrdersCount > 0 && (
              <span className="bg-[#dfb64c] text-[#0a1f13] text-[10px] font-bold px-1.5 py-0.2 rounded-full animate-pulse">
                {activeOrdersCount}
              </span>
            )}
          </button>

          {/* Cart Trigger */}
          <button
            id="view-cart-btn"
            onClick={onOpenCart}
            className="relative flex items-center gap-2 bg-gradient-to-r from-[#dfb64c] to-[#cba135] text-[#0a1f13] hover:from-[#e8c45f] hover:to-[#d6b23d] px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Cart</span>
            {cartCount > 0 && (
              <span className="bg-[#0a1f13] text-[#dfb64c] text-[11px] px-2 py-0.5 rounded-full font-mono">
                {cartCount} • ₹{cartTotal}
              </span>
            )}
          </button>

          {/* Logout */}
          <button
            id="customer-logout-btn"
            onClick={onLogout}
            className="p-2 text-[#9bb5a4] hover:text-[#fdfbf7] hover:bg-[#153b23] rounded-xl transition-colors cursor-pointer"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Search Bar */}
      <div className="md:hidden px-4 pb-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#799983]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search 22 categories (biryani, porotta, seafood...)"
            className="w-full bg-[#123620] border border-[#245937] rounded-xl pl-9 pr-3 py-2 text-xs text-[#fcfaf6] placeholder-[#6d8a76] focus:outline-none focus:border-[#dfb64c]"
          />
        </div>
      </div>
    </header>
  );
};
