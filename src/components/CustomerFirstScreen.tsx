import React from 'react';
import { Phone, ShieldCheck, Truck, UtensilsCrossed, Clock, ChevronRight, ArrowRight, MapPin } from 'lucide-react';
import { RestaurantProfile } from '../types';
import { WatermarkedImage } from './WatermarkedImage';

interface CustomerFirstScreenProps {
  restaurantProfile?: RestaurantProfile | null;
  onCreateAccount: () => void;
  onLogin: () => void;
}

export const CustomerFirstScreen: React.FC<CustomerFirstScreenProps> = ({ restaurantProfile, onCreateAccount, onLogin }) => {
  const restaurantName = restaurantProfile?.name || 'HOTEL MALABAR';
  const tagline = restaurantProfile?.tagline || 'Authentic Thalassery Biryani, Handcrafted Kerala Porottas, Fresh Coastal Seafood, Alfaham and traditional Malabar delicacies delivered hot to your doorstep.';
  const coverPhoto = restaurantProfile?.coverPhotoUrl || 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1400&q=90';
  const logoPhoto = restaurantProfile?.logoUrl;
  const phone1 = restaurantProfile?.phones?.[0] || '9567562071';
  const phone2 = restaurantProfile?.phones?.[1] || '8904634717';
  const isOnlineOpen = restaurantProfile?.isOnlineOrderOpen !== false;

  const categories = [
    ['Biryani', 'Authentic Flavours'],
    ['Tandoori', 'Grilled Perfection'],
    ['Shawarma', 'Fresh & Juicy'],
    ['Chinese', 'Wok Favourites'],
    ['Breakfast', 'Start Fresh'],
    ['Meals', 'Traditional Taste'],
  ];

  return (
    <div className="hm-landing min-h-screen bg-[#06160c] text-[#fcfaf6] overflow-x-hidden">
      <header className="relative z-20 border-b border-[#204d32] bg-[#071b10]/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-3 text-[10px] sm:text-xs">
          <div className="flex items-center gap-2 text-[#d8e2db]">
            <span className={`w-2 h-2 rounded-full ${isOnlineOpen ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="font-bold text-[#dfb64c]">{isOnlineOpen ? 'Orders Open' : 'Orders Closed'}</span>
            <span className="text-[#6d8c77]">•</span>
            <span>Cash on Delivery Only</span>
          </div>
          <a href={`tel:${phone1}`} className="flex items-center gap-1.5 text-[#d8e2db] hover:text-[#dfb64c]"><Phone className="w-3 h-3 text-[#dfb64c]" />{phone1}</a>
        </div>
      </header>

      <nav className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden border border-[#d6ae3a] bg-[#f7f3e9] shrink-0 shadow-lg">
            {logoPhoto ? <WatermarkedImage src={logoPhoto} alt={restaurantName} className="w-full h-full" watermarkSize="sm" /> : <div className="w-full h-full flex items-center justify-center"><UtensilsCrossed className="w-5 h-5 text-[#0b4a2a]" /></div>}
          </div>
          <div className="min-w-0">
            <div className="font-brand text-base sm:text-lg tracking-wide truncate">{restaurantName}</div>
            <div className="text-[8px] uppercase tracking-[0.22em] text-[#d7b24c] truncate">GOOD FOOD • BETTER MOODS</div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-[11px] font-semibold">
          <a href="/" className="px-3 py-1.5 rounded-lg text-[#dfb64c] bg-[#123620]">Home</a>
          <a href="/menu.html" className="px-3 py-1.5 rounded-lg text-[#d9e4dc] hover:text-[#dfb64c]">Menu</a>
          <a href="/about.html" className="px-3 py-1.5 rounded-lg text-[#d9e4dc] hover:text-[#dfb64c]">About</a>
          <a href="/contact.html" className="px-3 py-1.5 rounded-lg text-[#d9e4dc] hover:text-[#dfb64c]">Contact</a>
          <a href="/gallery.html" className="px-3 py-1.5 rounded-lg text-[#d9e4dc] hover:text-[#dfb64c]">Gallery</a>
          <button onClick={onLogin} className="ml-1 px-4 py-1.5 rounded-lg border border-[#d6ae3a] text-[#f4df9b] hover:bg-[#dfb64c] hover:text-[#082013] transition-all">Login</button>
        </div>
        <button onClick={onLogin} className="md:hidden px-3.5 py-1.5 rounded-lg border border-[#d6ae3a] text-[#f4df9b] text-[11px] font-bold">Login</button>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 pb-7">
        <section className="relative overflow-hidden rounded-[1.25rem] sm:rounded-[1.5rem] border border-[#d2aa42]/40 bg-[#0b2416] min-h-[390px] sm:min-h-[450px] flex items-center shadow-[0_22px_60px_rgba(0,0,0,.34)]">
          <div className="absolute inset-0 bg-gradient-to-r from-[#06160c] via-[#071b10]/95 to-transparent z-10" />
          <div className="absolute inset-y-0 right-0 w-full md:w-[64%]">
            <WatermarkedImage src={coverPhoto} alt={`${restaurantName} signature food`} className="w-full h-full object-cover" watermarkSize="md" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#06160c] via-[#06160c]/70 to-transparent" />
          </div>
          <div className="relative z-20 w-full max-w-xl px-5 py-10 sm:px-9 sm:py-12">
            <div className="inline-flex items-center gap-2 text-[9px] sm:text-[10px] uppercase tracking-[0.24em] text-[#dfb64c] font-bold mb-3"><span className="w-5 h-px bg-[#dfb64c]" />Authentic Malabar Cuisine</div>
            <h1 className="font-brand leading-[.95] mb-4"><span className="block text-4xl sm:text-6xl">Authentic</span><span className="block text-4xl sm:text-6xl text-[#dfb64c]">Malabar Taste</span></h1>
            <p className="text-xs sm:text-sm leading-6 text-[#d2ddd6] max-w-lg mb-5">{tagline}</p>
            <div className="flex flex-wrap gap-2.5">
              <button onClick={onCreateAccount} className="inline-flex items-center gap-2 bg-[#dfb64c] text-[#082013] font-bold px-5 py-2.5 rounded-lg text-xs hover:bg-[#ebc95d] transition-all shadow-lg">Order Now <ArrowRight className="w-4 h-4" /></button>
              <button onClick={onLogin} className="inline-flex items-center gap-2 border border-[#8aa696] text-[#f0f5f1] px-5 py-2.5 rounded-lg text-xs hover:border-[#dfb64c] transition-all">Login to Order</button>
            </div>
            <div className="flex items-center gap-2 mt-4 text-[10px] text-[#9db1a4]"><MapPin className="w-3.5 h-3.5 text-[#dfb64c]" />Delivered hot to selected nearby areas</div>
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 py-4 sm:py-5">
          {[
            [Truck, 'First 2 km', 'FREE DELIVERY'],
            [ShieldCheck, 'Cash on Delivery', 'ONLY'],
            [Clock, 'Freshly Cooked', 'HOT & FRESH'],
            [UtensilsCrossed, 'Authentic', 'MALABAR TASTE'],
          ].map(([Icon, title, sub], index) => (
            <div key={index} className="bg-[#0f2d1c] border border-[#255539] rounded-xl p-3 flex items-center gap-2.5 shadow-lg">
              <div className="w-9 h-9 rounded-full bg-[#173a27] text-[#dfb64c] flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></div>
              <div className="min-w-0"><div className="font-bold text-[11px] sm:text-xs truncate">{title}</div><div className="text-[9px] sm:text-[10px] text-[#91aa9a] truncate">{sub}</div></div>
            </div>
          ))}
        </section>

        <section className="rounded-[1.25rem] border border-[#d8bc6a]/25 bg-[#fbf8f0] text-[#102419] px-3 sm:px-6 py-6 sm:py-7 overflow-hidden">
          <div className="text-center mb-5"><p className="text-[#b18421] uppercase tracking-[0.28em] text-[9px] font-bold">Explore Our</p><h2 className="font-brand text-2xl sm:text-3xl mt-1">Menu Categories</h2><p className="text-[10px] sm:text-xs text-[#68786e] mt-1.5">Traditional flavours, prepared fresh for every order.</p></div>
          <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            {categories.map(([name, sub]) => (
              <a key={name} href="/menu.html" className="group bg-white rounded-xl p-2.5 sm:p-3 border border-[#e0d8c9] hover:-translate-y-0.5 hover:border-[#c9a338] transition-all shadow-sm text-center">
                <div className="h-14 sm:h-16 rounded-lg bg-[#edf5ef] mb-2 flex items-center justify-center text-[#0a4b2a]"><UtensilsCrossed className="w-6 h-6" /></div>
                <div className="font-bold text-[10px] sm:text-xs">{name}</div>
                <div className="text-[8px] sm:text-[9px] text-[#6c716d] mt-0.5 truncate">{sub}</div>
                <div className="mx-auto mt-2 w-6 h-6 rounded-full bg-[#0b4a2a] text-white flex items-center justify-center group-hover:bg-[#d8b13e] group-hover:text-[#092013] transition-colors"><ChevronRight className="w-3 h-3" /></div>
              </a>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[#234c32] py-5 px-4 text-center text-[10px] text-[#82978a] bg-[#07170e]">
        <div className="font-brand text-sm text-[#dfb64c]">{restaurantName}</div>
        <div className="mt-1">GOOD FOOD • BETTER MOODS</div>
        <div className="mt-1.5">Serving Bommasandra • Yarandahalli • Jigani • Electronic City</div>
        <a href={`tel:${phone2}`} className="inline-block mt-1.5 text-[#d7b24c] hover:underline">{phone2}</a>
      </footer>
    </div>
  );
};
