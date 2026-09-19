import React from 'react';
import { ArrowRight, ChevronRight, Clock, Heart, MapPin, ShieldCheck, Truck, UtensilsCrossed } from 'lucide-react';
import { RestaurantProfile } from '../types';
import { WatermarkedImage } from './WatermarkedImage';

interface CustomerFirstScreenProps {
  restaurantProfile?: RestaurantProfile | null;
  onCreateAccount: () => void;
  onLogin: () => void;
}

const CATEGORY_CARDS = [
  ['Breakfast', 'Fresh morning favourites', 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=500&q=85'],
  ['Meals', 'Traditional Malabar meals', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=500&q=85'],
  ['Biryani', 'A legacy in every bite', 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=500&q=85'],
  ['Tandoori', 'Charcoal grilled perfection', 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=500&q=85'],
  ['Shawarma', 'Fresh, juicy and loaded', 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=500&q=85'],
  ['Grill Chicken', 'Smoky Malabar grills', 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=500&q=85'],
  ['Tandoori Roti', 'Fresh from the tandoor', 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=500&q=85'],
  ['More', 'Explore the full menu', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=500&q=85'],
];

export const CustomerFirstScreen: React.FC<CustomerFirstScreenProps> = ({ restaurantProfile, onCreateAccount, onLogin }) => {
  const restaurantName = restaurantProfile?.name || 'HOTEL MALABAR';
  const tagline = restaurantProfile?.tagline || 'AUTHENTIC FLAVOURS. RIGHT AT YOUR DOORSTEP.';
  const description = restaurantProfile?.description || 'Freshly cooked Malabar favourites, biryani, tandoori, shawarma, grills and more — prepared with care.';
  const coverPhoto = restaurantProfile?.coverPhotoUrl || 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1600&q=90';
  const logoPhoto = restaurantProfile?.logoUrl;
  const phone1 = restaurantProfile?.phones?.[0] || '9567562071';
  const isOnlineOpen = restaurantProfile?.isOnlineOrderOpen !== false;

  return (
    <div className="hm-premium-landing min-h-screen bg-[#151210] text-[#f7f1e6] overflow-x-hidden">
      <header className="border-b border-[#8d6b35]/30 bg-[#151210]/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-7 py-2 flex items-center justify-between gap-3 text-[10px] sm:text-xs">
          <div className="flex items-center gap-2 text-[#d8d0c2]">
            <span className={`w-2 h-2 rounded-full ${isOnlineOpen ? 'bg-amber-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="font-bold text-[#e2b866]">{isOnlineOpen ? 'Orders Open' : 'Orders Closed'}</span>
            <span className="text-[#6f6559]">•</span><span>Cash on Delivery Only</span>
          </div>
          <a href={`tel:${phone1}`} className="hidden sm:block text-[#d8d0c2] hover:text-[#e2b866]">{phone1}</a>
        </div>
      </header>

      <nav className="max-w-7xl mx-auto px-4 sm:px-7 py-3 flex items-center justify-between gap-4 border-b border-[#8d6b35]/20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl overflow-hidden border border-[#d3a955] bg-[#f4eee2] shrink-0 shadow-lg">
            {logoPhoto ? <img src={logoPhoto} alt={`${restaurantName} logo`} className="w-full h-full object-contain p-1.5" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : <div className="w-full h-full flex items-center justify-center"><UtensilsCrossed className="w-5 h-5 text-[#80602f]" /></div>}
          </div>
          <div className="min-w-0">
            <div className="font-brand text-lg tracking-[0.08em] truncate">{restaurantName}</div>
            <div className="text-[8px] uppercase tracking-[0.26em] text-[#cda65a] truncate">TASTE OF MALABAR</div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-[11px] font-semibold">
          <a href="/" className="px-4 py-2 rounded-full bg-[#d8aa58] text-[#18130e]">Home</a>
          <a href="/menu.html" className="px-3 py-2 text-[#ddd4c7] hover:text-[#e2b866]">Menu</a>
          <a href="/about.html" className="px-3 py-2 text-[#ddd4c7] hover:text-[#e2b866]">About</a>
          <a href="/gallery.html" className="px-3 py-2 text-[#ddd4c7] hover:text-[#e2b866]">Gallery</a>
          <a href="/contact.html" className="px-3 py-2 text-[#ddd4c7] hover:text-[#e2b866]">Contact</a>
          <button onClick={onLogin} className="ml-2 px-4 py-2 rounded-full border border-[#d3a955] text-[#f1dfba] hover:bg-[#d8aa58] hover:text-[#18130e]">Login</button>
        </div>
        <button onClick={onLogin} className="md:hidden px-4 py-2 rounded-full border border-[#d3a955] text-[#f1dfba] text-[11px] font-bold">Login</button>
      </nav>

      <main className="max-w-7xl mx-auto">
        <section className="relative min-h-[470px] sm:min-h-[540px] overflow-hidden border-b border-[#9b753c]/30">
          <div className="absolute inset-0">
            <WatermarkedImage src={coverPhoto} alt={`${restaurantName} hotel and signature food`} className="w-full h-full object-cover" watermarkSize="md" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#17130f] via-[#17130f]/90 to-[#17130f]/15" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#151210] via-transparent to-[#151210]/20" />
          </div>
          <div className="relative z-10 min-h-[470px] sm:min-h-[540px] flex items-center px-5 sm:px-10 lg:px-14 py-12">
            <div className="max-w-xl">
              <div className="font-script text-3xl sm:text-4xl text-[#e3b96b] mb-2">Welcome to</div>
              <h1 className="font-brand text-4xl sm:text-6xl lg:text-7xl leading-[.9] tracking-wide text-white">{restaurantName}</h1>
              <p className="mt-4 text-[11px] sm:text-sm uppercase tracking-[0.32em] text-[#e3c57f] max-w-lg">{tagline}</p>
              <p className="mt-4 text-xs sm:text-sm leading-6 text-[#ddd4c7] max-w-lg">{description}</p>
              <div className="flex flex-wrap gap-2.5 mt-6">
                <button onClick={onCreateAccount} className="inline-flex items-center gap-2 bg-[#d8aa58] text-[#18130e] font-bold px-6 py-3 rounded-xl text-xs shadow-xl hover:bg-[#ebc978]">Order Now <ArrowRight className="w-4 h-4" /></button>
                <button onClick={onLogin} className="inline-flex items-center gap-2 border border-[#cbb998]/70 bg-black/20 text-white px-6 py-3 rounded-xl text-xs hover:border-[#e3b96b]">Login to Order</button>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-7 py-5 grid grid-cols-2 lg:grid-cols-4 gap-2.5 bg-[#181512] border-b border-[#8d6b35]/20">
          {[
            [Truck, 'Fresh Ingredients', 'AUTHENTIC RECIPES'],
            [UtensilsCrossed, 'Authentic Recipes', 'MALABAR KITCHEN'],
            [Clock, 'Fast Delivery', 'HOT & FRESH'],
            [Heart, 'Loved by Foodies', 'MADE WITH CARE'],
          ].map(([Icon, title, sub], i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-3 border-r border-[#8d6b35]/20 last:border-0">
              <Icon className="w-5 h-5 text-[#e0b568] shrink-0" />
              <div><div className="text-[11px] font-semibold text-[#f5eee4]">{title}</div><div className="text-[8px] uppercase tracking-wider text-[#a99d8e]">{sub}</div></div>
            </div>
          ))}
        </section>

        <section className="px-4 sm:px-7 py-7 bg-[#141210]">
          <div className="flex items-end justify-between mb-5">
            <div><p className="text-[9px] uppercase tracking-[0.34em] text-[#d2a757]">Authentic Malabar Cuisine</p><h2 className="font-brand text-2xl sm:text-3xl mt-1">Explore Our Menu</h2></div>
            <a href="/menu.html" className="text-[10px] border border-[#9b753c] rounded-full px-3 py-1.5 text-[#e3c17e]">View All</a>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {CATEGORY_CARDS.map(([name, sub, image]) => (
              <a key={name} href="/menu.html" className="group text-center">
                <div className="aspect-square rounded-2xl overflow-hidden border border-[#9b753c]/70 bg-[#211c16]">
                  <img src={image} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
                <div className="mt-2 text-[10px] sm:text-xs font-semibold text-[#f3ece1]">{name}</div>
                <div className="text-[8px] text-[#a99d8e] truncate">{sub}</div>
              </a>
            ))}
          </div>
        </section>

        <section className="relative min-h-[190px] overflow-hidden border-y border-[#8d6b35]/25">
          <img src={coverPhoto} alt="" className="absolute inset-0 w-full h-full object-cover opacity-45" />
          <div className="absolute inset-0 bg-[#17130f]/70" />
          <div className="relative z-10 min-h-[190px] flex flex-col items-center justify-center text-center px-5">
            <div className="font-script text-3xl text-[#e3b96b]">From Our Kitchen to Your Home</div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.35em] text-[#eee4d5]">MALABAR FOOD • MALABAR SOUL</div>
          </div>
        </section>
      </main>

      <footer className="bg-[#110f0d] border-t border-[#8d6b35]/25 text-[#9e9487] py-7 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-center sm:text-left"><div className="font-brand text-base text-[#e0b568]">{restaurantName}</div><div className="text-[9px] uppercase tracking-[0.2em] mt-1">TASTE OF MALABAR</div></div>
          <div className="flex gap-4 text-[10px]"><a href="/" className="hover:text-[#e0b568]">Home</a><a href="/menu.html" className="hover:text-[#e0b568]">Menu</a><a href="/about.html" className="hover:text-[#e0b568]">About</a><a href="/contact.html" className="hover:text-[#e0b568]">Contact</a></div>
          <div className="text-[9px]">Cash on Delivery • First 2 km Free</div>
        </div>
      </footer>
    </div>
  );
};
