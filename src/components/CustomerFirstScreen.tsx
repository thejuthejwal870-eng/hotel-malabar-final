import React from 'react';
import { Phone, ShieldCheck, Truck, UtensilsCrossed, Clock, ChevronRight } from 'lucide-react';
import { RestaurantProfile } from '../types';
import { WatermarkedImage } from './WatermarkedImage';

interface CustomerFirstScreenProps {
  restaurantProfile?: RestaurantProfile | null;
  onCreateAccount: () => void;
  onLogin: () => void;
}

export const CustomerFirstScreen: React.FC<CustomerFirstScreenProps> = ({
  restaurantProfile,
  onCreateAccount,
  onLogin,
}) => {
  const restaurantName = restaurantProfile?.name || 'HOTEL MALABAR';
  const tagline = restaurantProfile?.tagline || 'Authentic Thalassery Biryani, Handcrafted Kerala Porottas, Fresh Coastal Seafood, Alfaham, and traditional Malabar delicacies delivered hot to your doorstep.';
  const coverPhoto = restaurantProfile?.coverPhotoUrl || 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1200&q=85';
  const logoPhoto = restaurantProfile?.logoUrl;
  const phone1 = restaurantProfile?.phones?.[0] || '9567562071';
  const phone2 = restaurantProfile?.phones?.[1] || '8904634717';
  const isOnlineOpen = restaurantProfile?.isOnlineOrderOpen !== false;

  return (
    <div className="min-h-screen bg-[#0a1f13] text-[#fcfaf6] flex flex-col justify-between relative overflow-hidden font-sans selection:bg-[#cba135] selection:text-[#0a1f13]">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#1d5032]/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-[400px] h-[400px] bg-[#cba135]/10 rounded-full blur-2xl pointer-events-none" />

      <header className="relative z-10 w-full max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#1b432a]">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-[#e0d6be]">
          <span className={`inline-block w-2 h-2 rounded-full ${isOnlineOpen ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          <span className="font-medium text-[#dfb64c]">{isOnlineOpen ? 'Orders Open' : 'Orders Currently Closed'}</span>
          <span className="text-[#8ba794]">•</span>
          <span>Cash on Delivery Only</span>
        </div>

        <div className="flex items-center gap-3 text-xs text-[#dcd4c3]">
          <span className="hidden sm:inline text-[#a6bfae]">Hotlines:</span>
          <a href={`tel:${phone1}`} className="flex items-center gap-1 hover:text-[#dfb64c] transition-colors bg-[#11311e] px-2.5 py-1 rounded-full border border-[#214f34]">
            <Phone className="w-3 h-3 text-[#dfb64c]" />
            <span>{phone1}</span>
          </a>
          <a href={`tel:${phone2}`} className="hidden md:flex items-center gap-1 hover:text-[#dfb64c] transition-colors bg-[#11311e] px-2.5 py-1 rounded-full border border-[#214f34]">
            <Phone className="w-3 h-3 text-[#dfb64c]" />
            <span>{phone2}</span>
          </a>
        </div>
      </header>

      <main className="relative z-10 w-full max-w-4xl mx-auto px-4 py-8 sm:py-12 flex flex-col items-center text-center my-auto">
        <div className="relative mb-6">
          {logoPhoto ? (
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-[#cba135] shadow-2xl relative group bg-[#081a10]">
              <WatermarkedImage src={logoPhoto} alt={restaurantName} className="w-full h-full" watermarkSize="sm" />
            </div>
          ) : (
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-[#1b472e] via-[#10301e] to-[#0a1f13] border-2 border-[#cba135] shadow-2xl flex flex-col items-center justify-center p-2 relative group">
              <div className="absolute inset-1 border border-[#cba135]/40 rounded-xl pointer-events-none" />
              <UtensilsCrossed className="w-8 h-8 sm:w-10 sm:h-10 text-[#dfb64c] mb-1" />
              <span className="font-brand text-[9px] tracking-widest text-[#e8dcb8] font-bold uppercase">Est. Malabar</span>
            </div>
          )}
          <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-[#cba135] text-[#0a1f13] font-bold text-[10px] uppercase tracking-widest px-3 py-0.5 rounded-full shadow-md whitespace-nowrap">Pure Authentic</div>
        </div>

        <h1 className="font-brand text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-wide text-[#fdfbf7] drop-shadow-sm mb-2 uppercase">{restaurantName}</h1>
        <div className="h-0.5 w-32 bg-gradient-to-r from-transparent via-[#cba135] to-transparent mx-auto mb-3" />
        <p className="text-base sm:text-lg text-[#d8cfbe] max-w-xl mx-auto font-light leading-relaxed mb-6">{tagline}</p>

        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 mb-8 text-xs sm:text-sm text-[#e6dcc6]">
          <span className="bg-[#123620] border border-[#235636] px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm"><Truck className="w-4 h-4 text-[#dfb64c]" /><span><strong className="text-[#dfb64c]">First 2 km:</strong> FREE DELIVERY</span></span>
          <span className="bg-[#123620] border border-[#235636] px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm"><ShieldCheck className="w-4 h-4 text-[#dfb64c]" /><span>Cash on Delivery Only</span></span>
          <span className="bg-[#123620] border border-[#235636] px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm"><Clock className="w-4 h-4 text-[#dfb64c]" /><span>Freshly Cooked in 10 Mins</span></span>
        </div>

        <div className="w-full max-w-2xl bg-[#0f2d1c] border border-[#225435] rounded-2xl p-2.5 mb-8 shadow-2xl">
          <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden border border-[#cba135]/30">
            <WatermarkedImage src={coverPhoto} alt={`${restaurantName} Showcase Feast`} className="w-full h-full" watermarkSize="md" />
            <div className="absolute top-3 left-3 bg-[#0d2317]/90 backdrop-blur-md px-3 py-1 rounded-full border border-[#cba135]/40 text-xs font-medium text-[#dfb64c] shadow">★ Signature Thalassery Dum Biryani & Flaky Porotta</div>
          </div>
        </div>

        <div className="w-full max-w-md flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 mb-4">
          <button id="first-screen-create-account-btn" onClick={onCreateAccount} className="w-full sm:flex-1 bg-gradient-to-r from-[#dfb64c] to-[#cba135] hover:from-[#e7c35d] hover:to-[#d4af37] text-[#0a1f13] font-bold text-base sm:text-lg py-3.5 px-6 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer"><span>Create Account</span><ChevronRight className="w-5 h-5" /></button>
          <button id="first-screen-login-btn" onClick={onLogin} className="w-full sm:flex-1 bg-[#123620] hover:bg-[#184429] text-[#fdfbf7] font-semibold text-base sm:text-lg py-3.5 px-6 rounded-xl border border-[#2e6844] hover:border-[#dfb64c]/60 shadow-md transition-all cursor-pointer"><span>Login</span></button>
        </div>

        <p className="text-xs text-[#8ea896] max-w-sm">Please enter your phone number and name to explore our authentic Kerala menu and place your delivery order.</p>
      </main>

      <footer className="relative z-10 w-full max-w-6xl mx-auto px-4 py-4 border-t border-[#1b432a] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#9bb3a2]">
        <div className="flex items-center gap-2"><span>Serving: Bommasandra • Yarandahalli • Jigani • Electronic City</span></div>
        <div className="flex items-center gap-3 flex-wrap"><span>© Hotel Malabar • Authentic Coastal & Malabar Delicacies</span></div>
      </footer>
    </div>
  );
};
