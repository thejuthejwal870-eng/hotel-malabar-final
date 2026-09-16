import React from 'react';
import { Phone, ShieldCheck, Truck, UtensilsCrossed, Clock, ChevronRight, ArrowRight } from 'lucide-react';
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

  const navClass = 'px-5 py-2.5 rounded-full border border-[#315f45] bg-[#0c2a19]/80 text-[#f4ead6] font-semibold hover:border-[#d6ae3a] hover:text-[#e2bd55] transition-all';

  return (
    <div className="min-h-screen bg-[#061b10] text-[#fbfaf5] font-sans overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_70%_20%,rgba(34,91,57,.35),transparent_38%),radial-gradient(circle_at_15%_80%,rgba(24,72,44,.25),transparent_35%)]" />

      <header className="relative z-10 border-b border-[#17452b] bg-[#061b10]/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2 text-[#eee5d3]">
            <span className={`w-2.5 h-2.5 rounded-full ${isOnlineOpen ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="font-bold text-[#e0b946]">{isOnlineOpen ? 'Orders Open' : 'Orders Closed'}</span>
            <span className="text-[#668a72]">|</span>
            <span>Cash on Delivery Only</span>
          </div>
          <a href={`tel:${phone1}`} className="flex items-center gap-2 text-[#eadfca] hover:text-[#e0b946] transition-colors">
            <Phone className="w-4 h-4 text-[#e0b946]" /> <span>{phone1}</span>
          </a>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-3">
          {logoPhoto ? (
            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-[#d6ae3a] bg-[#f8f7f2] shadow-lg">
              <WatermarkedImage src={logoPhoto} alt={restaurantName} className="w-full h-full" watermarkSize="sm" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-2xl border border-[#d6ae3a] bg-[#f8f7f2] flex items-center justify-center shadow-lg">
              <UtensilsCrossed className="w-7 h-7 text-[#0c4b2a]" />
            </div>
          )}
          <div>
            <div className="font-brand text-xl sm:text-2xl font-bold tracking-wide">{restaurantName}</div>
            <div className="text-[10px] tracking-[0.28em] uppercase text-[#d7b24c]">Taste of Kerala</div>
          </div>
        </div>
        <nav aria-label="Hotel Malabar" className="flex flex-wrap justify-center gap-2">
          <a href="/menu.html" className={navClass}>Menu</a>
          <a href="/contact.html" className={navClass}>Contact Us</a>
          <a href="/about.html" className={navClass}>About Us</a>
          <a href="/gallery.html" className={navClass}>Gallery</a>
          <button onClick={onLogin} className="px-5 py-2.5 rounded-full bg-[#d8b13e] text-[#082013] font-bold hover:bg-[#e6c55e] transition-all shadow-lg">Login</button>
        </nav>
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#245a39] bg-[#092719] shadow-2xl min-h-[560px] flex items-center">
          <div className="absolute inset-0 bg-gradient-to-r from-[#061b10] via-[#092719]/95 to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-full md:w-[62%]">
            <WatermarkedImage src={coverPhoto} alt={`${restaurantName} signature food`} className="w-full h-full object-cover" watermarkSize="md" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#061b10] via-[#061b10]/45 to-transparent" />
          </div>

          <div className="relative z-20 max-w-2xl px-7 sm:px-12 py-14">
            <p className="text-[#d8b13e] uppercase tracking-[0.28em] text-sm font-semibold mb-4">Authentic Kerala Cuisine</p>
            <h1 className="font-brand uppercase leading-[.9] mb-6">
              <span className="block text-5xl sm:text-7xl text-[#fffdf7]">Hotel</span>
              <span className="block text-5xl sm:text-7xl text-[#dfb449]">Malabar</span>
            </h1>
            <div className="h-px w-28 bg-[#d8b13e] mb-6" />
            <p className="text-base sm:text-lg text-[#ded7c9] leading-8 max-w-xl mb-8">{tagline}</p>
            <div className="flex flex-wrap gap-3">
              <button onClick={onCreateAccount} className="inline-flex items-center gap-2 bg-[#dfb449] text-[#082013] font-bold px-7 py-3.5 rounded-xl hover:bg-[#e8c45a] transition-all shadow-xl">
                Order Online <ArrowRight className="w-5 h-5" />
              </button>
              <button onClick={onLogin} className="inline-flex items-center gap-2 border border-[#d8b13e] text-[#f8efd9] px-7 py-3.5 rounded-xl hover:bg-[#d8b13e]/10 transition-all">
                Login to Order
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 py-7">
          {[
            [Truck, 'First 2 km', 'FREE DELIVERY'],
            [ShieldCheck, 'Cash on Delivery', 'ONLY'],
            [Clock, 'Freshly Cooked', 'in 10 Minutes'],
            [UtensilsCrossed, 'Authentic', 'MALABAR TASTE'],
          ].map(([Icon, title, sub], index) => (
            <div key={index} className="bg-[#f7f2e7] text-[#0a2717] rounded-2xl p-4 sm:p-5 flex items-center gap-3 shadow-lg border border-[#e4dac5]">
              <div className="w-11 h-11 rounded-full bg-[#0b4a2a] text-[#e2bd55] flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></div>
              <div><div className="font-bold text-sm sm:text-base">{title}</div><div className="text-xs sm:text-sm font-semibold">{sub}</div></div>
            </div>
          ))}
        </section>

        <section className="rounded-[2rem] bg-[#f8f3e8] text-[#0a2918] px-5 sm:px-10 py-12 mb-10 border border-[#e4dac5] overflow-hidden relative">
          <div className="relative z-10 text-center">
            <p className="text-[#c39a2d] uppercase tracking-[0.3em] text-xs font-semibold">Explore Our</p>
            <h2 className="font-brand text-4xl sm:text-5xl mt-2">Our Menu</h2>
            <p className="text-[#5c665f] max-w-2xl mx-auto mt-3">A wide range of authentic Kerala and Malabar dishes prepared with traditional recipes and the finest ingredients.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mt-8">
            {[
              ['Biryani', 'Authentic Flavours'],
              ['Porotta', 'Soft & Flaky'],
              ['Alfaham', 'Grilled Perfection'],
              ['Seafood', 'Fresh & Delicious'],
              ['Breakfast', 'Start Your Day Right'],
              ['Meals', 'Traditional Taste'],
            ].map(([name, sub]) => (
              <a key={name} href="/menu.html" className="group bg-white rounded-2xl p-4 border border-[#e3dccd] hover:-translate-y-1 hover:border-[#c9a338] transition-all shadow-sm">
                <div className="h-20 rounded-xl bg-[#e8efe8] mb-3 flex items-center justify-center text-[#0a4b2a]"><UtensilsCrossed className="w-8 h-8" /></div>
                <div className="font-bold">{name}</div>
                <div className="text-xs text-[#6c716d] mt-1">{sub}</div>
                <div className="mt-3 w-8 h-8 rounded-full bg-[#0b4a2a] text-white flex items-center justify-center group-hover:bg-[#d8b13e] group-hover:text-[#092013] transition-colors"><ChevronRight className="w-4 h-4" /></div>
              </a>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-[#17452b] py-8 text-center text-sm text-[#9eb4a5]">
        <div>{restaurantName} • Authentic Coastal & Malabar Delicacies</div>
        <div className="mt-2">Serving Bommasandra • Yarandahalli • Jigani • Electronic City</div>
        <a href={`tel:${phone2}`} className="inline-block mt-2 text-[#dfb449] hover:underline">{phone2}</a>
      </footer>
    </div>
  );
};
