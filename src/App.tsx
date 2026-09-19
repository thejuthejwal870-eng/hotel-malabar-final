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
  if (!customerUser) return <><CustomerFirstScreen restaurantProfile={restaurantProfile} onCreateAccount={() => { setAuthInitialMode('register'); setAuthModalOpen(true); }} onLogin={() => { setAuthInitialMode('login'); setAuthModalOpen(true); }} /><CustomerAuthModal isOpen={authModalOpen} initialMode={authInitialMode} restaurantProfile={restaurantProfile} onClose={() => setAuthModalOpen(false)} onAuthSuccess={handleAuthSuccess} /></>;

  const heroImage = restaurantProfile?.coverPhotoUrl || menuItems[0]?.imageUrl || 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1400&q=90';

  return (
    <div className="customer-reference-app min-h-screen bg-[#151210] text-[#f7f1e6] flex flex-col font-sans selection:bg-[#cba135] selection:text-[#18130e]">
      <CustomerHeader restaurantProfile={restaurantProfile} user={customerUser} cartCount={cartTotalItemsCount} cartTotal={cartFoodTotal} activeOrdersCount={activeOrdersCount} searchQuery={searchQuery} onSearchChange={setSearchQuery} onOpenCart={() => setIsCartOpen(true)} onOpenOrders={() => setIsOrderHistoryOpen(true)} onLogout={handleLogout} />

      <section className="customer-reference-hero relative overflow-hidden border-b border-[#c9a338]/25">
        <div className="absolute inset-0"><img src={heroImage} alt="Hotel Malabar signature dish" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-r from-[#17130f] via-[#17130f]/90 to-[#17130f]/20" /><div className="absolute inset-0 bg-gradient-to-t from-[#151210] via-transparent to-transparent" /></div>
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 py-10 sm:py-14 lg:py-16 min-h-[280px] sm:min-h-[350px] flex items-center">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dfb64c]/50 bg-[#151210]/70 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-[#e0b568] backdrop-blur-sm"><UtensilsCrossed className="w-3.5 h-3.5" /> Authentic Malabar Cuisine</div>
            <h1 className="font-brand text-3xl sm:text-5xl lg:text-6xl leading-[.95] mt-3"><span className="block text-[#f7f1e6]">Authentic Malabar</span><span className="block text-[#e0b568]">Taste Delivered</span></h1>
            <p className="mt-3 text-xs sm:text-sm text-[#d8d0c2] max-w-lg leading-6">Freshly cooked Kerala favourites, biryani, tandoori, shawarma and more — delivered with care.</p>
            <button onClick={() => document.getElementById('most-ordered-section')?.scrollIntoView({ behavior: 'smooth' })} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#d8aa58] text-[#151210] font-bold text-xs px-4 py-2.5 shadow-lg hover:bg-[#ebc978]">Order Now <ArrowRight className="w-4 h-4" /></button>
          </div>
        </div>
      </section>

      <CategoryFilter categories={categories} selectedCategoryId={selectedCategoryId} onSelectCategory={setSelectedCategoryId} categoryCounts={categoryCounts} />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-5 sm:py-6">
        {!deliverySettings.isRestaurantOpen && <div className="mb-5 p-3.5 bg-red-950 border-2 border-red-500/80 rounded-2xl shadow-xl flex items-center gap-3 text-red-200"><AlertTriangle className="w-5 h-5 text-red-400" /><div><h3 className="text-sm font-bold text-white uppercase tracking-wider">RESTAURANT CLOSED — Online Ordering Paused</h3><p className="text-xs text-red-300 mt-0.5">We are currently not accepting new online orders. Checkout will resume when the restaurant reopens.</p></div></div>}
        {selectedCategoryId !== 'all' && categories.find(c => c.id === selectedCategoryId)?.isActive === false && <div className="mb-5 p-3 bg-amber-950/70 border border-amber-600/70 rounded-2xl shadow flex items-center gap-3 text-amber-200 text-xs"><AlertTriangle className="w-4 h-4 text-amber-400" /><div><strong className="block text-white text-xs font-bold uppercase tracking-wider">Category Currently Unavailable</strong><span>Dishes in this category cannot be ordered right now.</span></div></div>}
        {activeOrdersCount > 0 && customerOrders[0] && <div onClick={() => setActiveTrackingOrderId(customerOrders[0].id)} className="mb-5 p-3.5 bg-gradient-to-r from-[#241e17] via-[#33271a] to-[#241e17] border-2 border-[#dfb64c] rounded-2xl shadow-xl flex items-center justify-between gap-3 cursor-pointer"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-[#dfb64c] text-[#18130e] flex items-center justify-center font-bold"><Clock className="w-4 h-4" /></div><div><span className="text-[10px] font-mono font-bold text-[#e0b568]">ACTIVE ORDER {customerOrders[0].orderNumber}</span><h4 className="text-xs font-semibold text-[#f7f1e6]">Status: {customerOrders[0].status}</h4></div></div><span className="bg-[#18130e] text-[#e0b568] text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border border-[#cba135]/50">Track Live →</span></div>}
        {filteredMostOrdered.length > 0 && <section id="most-ordered-section" className="mb-8 pb-6 border-b border-[#5b4728]"><div className="flex flex-wrap items-center justify-between gap-2 mb-4"><div><h2 className="font-brand text-xl sm:text-2xl font-bold text-[#f7f1e6] flex items-center gap-2"><span>🔥</span><span>Most Ordered</span></h2><p className="text-[11px] text-[#a99d8e] mt-0.5">Customer favourites from our authentic kitchen.</p></div><span className="text-[10px] text-[#e0b568] bg-[#2a2118] border border-[#5b4728] px-2.5 py-1 rounded-full font-bold">Customer Favorites</span></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{filteredMostOrdered.map(item => { const cat = categories.find(c => c.id === item.categoryId); const cartItem = cartItems.find(ci => ci.menuItem.id === item.id); return <FoodCard key={`most-ordered-${item.id}`} item={item} categoryName={cat?.name} cartQuantity={cartItem?.quantity || 0} isRestaurantOpen={deliverySettings.isRestaurantOpen} isCategoryOpen={cat?.isActive !== false} onAddToCart={handleAddToCart} onUpdateQuantity={handleUpdateCartQuantity} />; })}</div></section>}