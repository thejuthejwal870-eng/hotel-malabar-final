import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CustomerFirstScreen } from './components/CustomerFirstScreen';
import { CustomerAuthModal } from './components/CustomerAuthModal';
import { CustomerHeader } from './components/CustomerHeader';
import { CategoryFilter } from './components/CategoryFilter';
import { FoodCard } from './components/FoodCard';
import { CustomerCartDrawer } from './components/CustomerCartDrawer';
import { OrderStatusView } from './components/OrderStatusView';
import { CustomerOrderHistory } from './components/CustomerOrderHistory';
import { AdminDashboard } from './components/AdminDashboard';
import { User, CustomerProfile, MenuItem, MenuCategory, CartItem, DeliverySettings, DeliveryArea, Order, RestaurantProfile } from './types';
import { AlertTriangle, Clock, ArrowRight, UtensilsCrossed } from 'lucide-react';

export default function App() {
  const isAdminPath = () => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    return path === '/admin' || path === '/admin/' || path.startsWith('/admin/') || hash === '#admin' || hash === '#/admin' || hash.startsWith('#admin/') || hash.startsWith('#/admin/') || search.includes('admin=true') || search.includes('view=admin');
  };
  const [viewMode, setViewMode] = useState<'customer' | 'admin'>(() => isAdminPath() ? 'admin' : 'customer');
  useEffect(() => {
    const handleLocationChange = () => setViewMode(isAdminPath() ? 'admin' : 'customer');
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    window.history.pushState = function (...args) { const result = originalPushState.apply(this, args); handleLocationChange(); return result; };
    window.history.replaceState = function (...args) { const result = originalReplaceState.apply(this, args); handleLocationChange(); return result; };
    const handleKeyDown = (e: KeyboardEvent) => { if ((e.altKey || e.ctrlKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) { e.preventDefault(); window.history.pushState({}, '', '/admin'); } };
    window.addEventListener('popstate', handleLocationChange); window.addEventListener('hashchange', handleLocationChange); window.addEventListener('keydown', handleKeyDown);
    return () => { window.history.pushState = originalPushState; window.history.replaceState = originalReplaceState; window.removeEventListener('popstate', handleLocationChange); window.removeEventListener('hashchange', handleLocationChange); window.removeEventListener('keydown', handleKeyDown); };
  }, []);
  const navigateToCustomer = () => { if (typeof window !== 'undefined') window.history.pushState({}, '', '/'); setViewMode('customer'); };
  const navigateToAdmin = () => { if (typeof window !== 'undefined') window.history.pushState({}, '', '/admin'); setViewMode('admin'); };

  const [customerUser, setCustomerUser] = useState<User | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | undefined>(undefined);
  const [restaurantProfile, setRestaurantProfile] = useState<RestaurantProfile | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [mostOrderedItems, setMostOrderedItems] = useState<MenuItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings>({ freeDeliveryKm: 2, perKmCharge: 50, minOrderAmount: 200, isServiceActive: true, defaultPrepTimeMinutes: 10 });
  const [deliveryAreas, setDeliveryAreas] = useState<DeliveryArea[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeTrackingOrderId, setActiveTrackingOrderId] = useState<string | null>(null);
  const [isOrderHistoryOpen, setIsOrderHistoryOpen] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);

  useEffect(() => {
    let isMounted = true;
    const savedToken = localStorage.getItem('hm_customer_token');
    if (savedToken) {
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${savedToken}` } }).then(res => { if (res.ok) return res.json(); throw new Error('Session expired'); }).then(data => { if (isMounted) { setCustomerUser(data.user); setCustomerProfile(data.profile); } }).catch(() => { if (isMounted) { localStorage.removeItem('hm_customer_token'); setCustomerUser(null); setCustomerProfile(undefined); } });
    }
    return () => { isMounted = false; };
  }, []);

  const fetchMenuAndSettings = useCallback(async () => {
    try {
      const [menuRes, settingsRes] = await Promise.all([fetch('/api/menu'), fetch('/api/settings')]);
      if (menuRes.ok) { const mData = await menuRes.json(); setCategories(mData.categories || []); setMenuItems(mData.items || []); setMostOrderedItems(mData.mostOrdered || []); }
      if (settingsRes.ok) { const sData = await settingsRes.json(); if (sData.deliverySettings) setDeliverySettings(sData.deliverySettings); setDeliveryAreas(sData.deliveryAreas || []); if (sData.restaurantProfile) setRestaurantProfile(sData.restaurantProfile); }
    } catch (err) { console.warn('Notice: Server initializing or network reconnecting:', err); }
  }, []);
  useEffect(() => { fetchMenuAndSettings(); const interval = setInterval(() => { if (!document.hidden) fetchMenuAndSettings(); }, 8000); const handleVisibility = () => { if (!document.hidden) fetchMenuAndSettings(); }; document.addEventListener('visibilitychange', handleVisibility); return () => { clearInterval(interval); document.removeEventListener('visibilitychange', handleVisibility); }; }, [fetchMenuAndSettings]);
  useEffect(() => { const handleRatingSubmitted = () => fetchMenuAndSettings(); window.addEventListener('hm_rating_submitted', handleRatingSubmitted); return () => window.removeEventListener('hm_rating_submitted', handleRatingSubmitted); }, [fetchMenuAndSettings]);
  useEffect(() => { if (menuItems.length > 0) setCartItems(prev => prev.map(ci => { const fresh = menuItems.find(m => m.id === ci.menuItem.id); return fresh ? { ...ci, menuItem: fresh } : ci; })); }, [menuItems]);
  useEffect(() => {
    if (!customerUser) return;
    let isMounted = true;
    const fetchCustomerOrders = async () => { if (document.hidden) return; const token = localStorage.getItem('hm_customer_token'); if (!token) return; try { const res = await fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } }); if (!isMounted) return; if (res.ok) setCustomerOrders(await res.json()); else if (res.status === 401) { localStorage.removeItem('hm_customer_token'); setCustomerUser(null); setCustomerProfile(undefined); } } catch { console.warn('Orders poll: waiting for connection...'); } };
    fetchCustomerOrders(); const interval = setInterval(fetchCustomerOrders, 6000); const handleVisibility = () => { if (!document.hidden) fetchCustomerOrders(); }; document.addEventListener('visibilitychange', handleVisibility); return () => { isMounted = false; clearInterval(interval); document.removeEventListener('visibilitychange', handleVisibility); };
  }, [customerUser]);

  const handleAuthSuccess = useCallback((token: string, user: User) => { localStorage.setItem('hm_customer_token', token); setCustomerUser(user); setAuthModalOpen(false); fetchMenuAndSettings(); }, [fetchMenuAndSettings]);
  const handleLogout = useCallback(() => { localStorage.removeItem('hm_customer_token'); setCustomerUser(null); setCustomerProfile(undefined); setCartItems([]); setActiveTrackingOrderId(null); }, []);
  const handleAddToCart = useCallback((item: MenuItem) => { if (!item.isAvailable) return; setCartItems(prev => { const existing = prev.find(ci => ci.menuItem.id === item.id); return existing ? prev.map(ci => ci.menuItem.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci) : [...prev, { menuItem: item, quantity: 1 }]; }); }, []);
  const handleUpdateCartQuantity = useCallback((itemId: string, delta: number) => { setCartItems(prev => { const item = prev.find(ci => ci.menuItem.id === itemId); if (!item || (delta > 0 && !item.menuItem.isAvailable)) return prev; return prev.map(ci => ci.menuItem.id === itemId ? { ...ci, quantity: ci.quantity + delta } : ci).filter(ci => ci.quantity > 0); }); }, []);
  const handleRemoveCartItem = useCallback((itemId: string) => setCartItems(prev => prev.filter(ci => ci.menuItem.id !== itemId)), []);
  const handleClearCart = useCallback(() => setCartItems([]), []);
  const handleOrderPlaced = useCallback((newOrder: Order) => { setActiveTrackingOrderId(newOrder.id); setCustomerOrders(prev => [newOrder, ...prev]); }, []);
  const cartTotalItemsCount = useMemo(() => cartItems.reduce((sum, item) => sum + item.quantity, 0), [cartItems]);
  const cartFoodTotal = useMemo(() => cartItems.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0), [cartItems]);
  const activeOrdersCount = useMemo(() => customerOrders.filter(o => ['Order Placed', 'Accepted', 'Preparing', 'Ready', 'Out for Delivery'].includes(o.status)).length, [customerOrders]);
  const categoryCounts = useMemo(() => { const counts: Record<string, number> = {}; menuItems.forEach(item => { counts[item.categoryId] = (counts[item.categoryId] || 0) + 1; }); return counts; }, [menuItems]);
  const filteredMenuItems = useMemo(() => menuItems.filter(item => { if (selectedCategoryId !== 'all' && item.categoryId !== selectedCategoryId) return false; if (!searchQuery.trim()) return true; const q = searchQuery.toLowerCase(); return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q); }), [menuItems, selectedCategoryId, searchQuery]);
  const filteredMostOrdered = useMemo(() => mostOrderedItems.filter(item => { if (selectedCategoryId !== 'all' && item.categoryId !== selectedCategoryId) return false; if (!searchQuery.trim()) return true; const q = searchQuery.toLowerCase(); return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q); }), [mostOrderedItems, selectedCategoryId, searchQuery]);

  if (viewMode === 'admin') return <div className="admin-page-shell"><AdminDashboard onBackToCustomerSite={navigateToCustomer} /></div>;
  if (!customerUser) return <><CustomerFirstScreen restaurantProfile={restaurantProfile} onCreateAccount={() => { setAuthInitialMode('register'); setAuthModalOpen(true); }} onLogin={() => { setAuthInitialMode('login'); setAuthModalOpen(true); }} onOpenAdmin={navigateToAdmin} /><CustomerAuthModal isOpen={authModalOpen} initialMode={authInitialMode} onClose={() => setAuthModalOpen(false)} onAuthSuccess={handleAuthSuccess} /></>;

  const heroImage = restaurantProfile?.coverPhotoUrl || menuItems[0]?.imageUrl || 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1400&q=90';

  return (
    <div className="customer-reference-app min-h-screen bg-[#151210] text-[#f7f1e6] flex flex-col font-sans selection:bg-[#cba135] selection:text-[#18130e]">
      <CustomerHeader restaurantProfile={restaurantProfile} user={customerUser} cartCount={cartTotalItemsCount} cartTotal={cartFoodTotal} activeOrdersCount={activeOrdersCount} searchQuery={searchQuery} onSearchChange={setSearchQuery} onOpenCart={() => setIsCartOpen(true)} onOpenOrders={() => setIsOrderHistoryOpen(true)} onLogout={handleLogout} />

      <section className="customer-reference-hero relative overflow-hidden border-b border-[#c9a338]/25">
        <div className="absolute inset-0"><img src={heroImage} alt="Hotel Malabar signature dish" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-r from-[#06160c] via-[#06160c]/90 to-[#06160c]/20" /><div className="absolute inset-0 bg-gradient-to-t from-[#07170e] via-transparent to-transparent" /></div>
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 py-10 sm:py-14 lg:py-16 min-h-[280px] sm:min-h-[350px] flex items-center">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dfb64c]/50 bg-[#151210]/70 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-[#e0b568] backdrop-blur-sm"><UtensilsCrossed className="w-3.5 h-3.5" /> Authentic Malabar Cuisine</div>
            <h1 className="font-brand text-3xl sm:text-5xl lg:text-6xl leading-[.95] mt-3"><span className="block text-[#f7f1e6]">Authentic Malabar</span><span className="block text-[#e0b568]">Taste Delivered</span></h1>
            <p className="mt-3 text-xs sm:text-sm text-[#d8d0c2] max-w-lg leading-6">Freshly cooked Kerala favourites, biryani, tandoori, shawarma and more — delivered with care.</p>
            <button onClick={() => document.getElementById('most-ordered-section')?.scrollIntoView({ behavior: 'smooth' })} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#d8aa58] text-[#07170e] font-bold text-xs px-4 py-2.5 shadow-lg hover:bg-[#ebc978]">Order Now <ArrowRight className="w-4 h-4" /></button>
          </div>
        </div>
      </section>

      <CategoryFilter categories={categories} selectedCategoryId={selectedCategoryId} onSelectCategory={setSelectedCategoryId} categoryCounts={categoryCounts} />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-5 sm:py-6">
        {!deliverySettings.isRestaurantOpen && <div className="mb-5 p-3.5 bg-red-950 border-2 border-red-500/80 rounded-2xl shadow-xl flex items-center gap-3 text-red-200"><AlertTriangle className="w-5 h-5 text-red-400" /><div><h3 className="text-sm font-bold text-white uppercase tracking-wider">RESTAURANT CLOSED — Online Ordering Paused</h3><p className="text-xs text-red-300 mt-0.5">We are currently not accepting new online orders. Checkout will resume when the restaurant reopens.</p></div></div>}
        {selectedCategoryId !== 'all' && categories.find(c => c.id === selectedCategoryId)?.isActive === false && <div className="mb-5 p-3 bg-amber-950/70 border border-amber-600/70 rounded-2xl shadow flex items-center gap-3 text-amber-200 text-xs"><AlertTriangle className="w-4 h-4 text-amber-400" /><div><strong className="block text-white text-xs font-bold uppercase tracking-wider">Category Currently Unavailable</strong><span>Dishes in this category cannot be ordered right now.</span></div></div>}
        {activeOrdersCount > 0 && customerOrders[0] && <div onClick={() => setActiveTrackingOrderId(customerOrders[0].id)} className="mb-5 p-3.5 bg-gradient-to-r from-[#241e17] via-[#33271a] to-[#241e17] border-2 border-[#dfb64c] rounded-2xl shadow-xl flex items-center justify-between gap-3 cursor-pointer"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-[#dfb64c] text-[#0a1f13] flex items-center justify-center font-bold"><Clock className="w-4 h-4" /></div><div><span className="text-[10px] font-mono font-bold text-[#e0b568]">ACTIVE ORDER {customerOrders[0].orderNumber}</span><h4 className="text-xs font-semibold text-[#f7f1e6]">Status: {customerOrders[0].status}</h4></div></div><span className="bg-[#18130e] text-[#e0b568] text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border border-[#cba135]/50">Track Live →</span></div>}
        {filteredMostOrdered.length > 0 && <section id="most-ordered-section" className="mb-8 pb-6 border-b border-[#5b4728]"><div className="flex flex-wrap items-center justify-between gap-2 mb-4"><div><h2 className="font-brand text-xl sm:text-2xl font-bold text-[#f7f1e6] flex items-center gap-2"><span>🔥</span><span>Most Ordered</span></h2><p className="text-[11px] text-[#a99d8e] mt-0.5">Customer favourites from our authentic kitchen.</p></div><span className="text-[10px] text-[#e0b568] bg-[#2a2118] border border-[#5b4728] px-2.5 py-1 rounded-full font-bold">Customer Favorites</span></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{filteredMostOrdered.map(item => { const cat = categories.find(c => c.id === item.categoryId); const cartItem = cartItems.find(ci => ci.menuItem.id === item.id); return <FoodCard key={`most-ordered-${item.id}`} item={item} categoryName={cat?.name} cartQuantity={cartItem?.quantity || 0} isRestaurantOpen={deliverySettings.isRestaurantOpen} isCategoryOpen={cat?.isActive !== false} onAddToCart={handleAddToCart} onUpdateQuantity={handleUpdateCartQuantity} />; })}</div></section>}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4"><div><h2 className="font-brand text-xl sm:text-2xl font-bold text-[#f7f1e6]">{selectedCategoryId === 'all' ? 'Authentic Malabar Menu' : categories.find(c => c.id === selectedCategoryId)?.name || 'Food Menu'}</h2><p className="text-[11px] text-[#a99d8e] mt-0.5">Freshly prepared Kerala and Malabar dishes.</p></div><span className="text-[10px] text-[#ddd4c7] bg-[#241e17] border border-[#5b4728] px-2.5 py-1 rounded-full">{filteredMenuItems.length} dishes</span></div>
        {filteredMenuItems.length === 0 ? <div className="bg-[#211c16] border border-[#5b4728] rounded-2xl p-10 text-center text-[#a99d8e] my-8"><p className="text-sm font-semibold text-[#f7f1e6] mb-1">No food items found</p><p className="text-xs">Try a different dish or category.</p></div> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{filteredMenuItems.map(item => { const cat = categories.find(c => c.id === item.categoryId); const cartItem = cartItems.find(ci => ci.menuItem.id === item.id); return <FoodCard key={item.id} item={item} categoryName={cat?.name} cartQuantity={cartItem?.quantity || 0} isRestaurantOpen={deliverySettings.isRestaurantOpen} isCategoryOpen={cat?.isActive !== false} onAddToCart={handleAddToCart} onUpdateQuantity={handleUpdateCartQuantity} />; })}</div>}
      </main>
      {cartItems.length > 0 && !isCartOpen && <div className="fixed bottom-4 inset-x-4 max-w-lg mx-auto z-30"><button onClick={() => setIsCartOpen(true)} className="w-full bg-gradient-to-r from-[#dfb64c] to-[#b98b43] text-[#0a1f13] font-bold py-3 px-5 rounded-2xl shadow-2xl flex items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="bg-[#0a1f13] text-[#e0b568] text-xs font-mono font-bold px-2.5 py-1 rounded-lg">{cartTotalItemsCount} {cartTotalItemsCount === 1 ? 'item' : 'items'}</span><span className="text-sm font-semibold">View Order Cart</span></div><div className="flex items-center gap-1.5 font-mono text-base"><span>₹{cartFoodTotal}</span><span>→</span></div></button></div>}
      <CustomerCartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} cartItems={cartItems} deliverySettings={deliverySettings} deliveryAreas={deliveryAreas} user={customerUser} profile={customerProfile} isRestaurantOpen={deliverySettings.isRestaurantOpen} onUpdateQuantity={handleUpdateCartQuantity} onRemoveItem={handleRemoveCartItem} onClearCart={handleClearCart} onOrderPlaced={handleOrderPlaced} />
      {activeTrackingOrderId && <OrderStatusView orderId={activeTrackingOrderId} onClose={() => setActiveTrackingOrderId(null)} />}
      <CustomerOrderHistory isOpen={isOrderHistoryOpen} onClose={() => setIsOrderHistoryOpen(false)} onSelectOrder={orderId => { setIsOrderHistoryOpen(false); setActiveTrackingOrderId(orderId); }} />
      <footer className="bg-[#151210] border-t border-[#5b4728] text-xs text-[#a99d8e] py-7 px-4 mt-10"><div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3"><div className="text-center sm:text-left select-none"><h4 className="font-brand font-bold text-sm text-[#fdfbf7]">HOTEL MALABAR</h4><p className="text-[10px] text-[#789682] mt-0.5">Authentic Kerala & Coastal Delicacies • Bommasandra / Electronic City</p></div><div className="flex flex-wrap items-center justify-center gap-3 text-[10px]"><span>Hotlines: 9567562071 / 8904634717</span><span>•</span><span>100% Cash on Delivery</span><span>•</span><button id="customer-footer-admin-btn" onClick={navigateToAdmin} className="text-[#648871] hover:text-[#e0b568] transition-colors underline underline-offset-2">Admin Portal</button></div></div></footer>
    </div>
  );
}
