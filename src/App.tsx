import React, { useState, useEffect } from 'react';
import { CustomerFirstScreen } from './components/CustomerFirstScreen';
import { CustomerAuthModal } from './components/CustomerAuthModal';
import { CustomerHeader } from './components/CustomerHeader';
import { CategoryFilter } from './components/CategoryFilter';
import { FoodCard } from './components/FoodCard';
import { CustomerCartDrawer } from './components/CustomerCartDrawer';
import { OrderStatusView } from './components/OrderStatusView';
import { CustomerOrderHistory } from './components/CustomerOrderHistory';
import { AdminDashboard } from './components/AdminDashboard';
import {
  User,
  CustomerProfile,
  MenuItem,
  MenuCategory,
  CartItem,
  DeliverySettings,
  DeliveryArea,
  Order,
} from './types';
import { ShieldCheck, ShieldAlert, Truck, Clock, Sparkles, AlertTriangle } from 'lucide-react';

export default function App() {
  // Navigation mode: 'customer' | 'admin'
  // Check URL pathname or hash for private admin access (/admin, #admin, #/admin, ?admin)
  const isAdminPath = () => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    return (
      path === '/admin' ||
      path === '/admin/' ||
      path === '/admin/login' ||
      path === '/admin/login/' ||
      path.startsWith('/admin') ||
      hash === '#admin' ||
      hash === '#/admin' ||
      hash === '#admin/login' ||
      hash === '#/admin/login' ||
      hash.startsWith('#admin') ||
      hash.startsWith('#/admin') ||
      search.includes('admin=true') ||
      search.includes('view=admin')
    );
  };

  const [viewMode, setViewMode] = useState<'customer' | 'admin'>(() => {
    return isAdminPath() ? 'admin' : 'customer';
  });

  // Listen for browser navigation changes and shortcut keys
  useEffect(() => {
    const handleLocationChange = () => {
      setViewMode(isAdminPath() ? 'admin' : 'customer');
    };

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (...args) {
      const res = originalPushState.apply(this, args);
      handleLocationChange();
      return res;
    };

    window.history.replaceState = function (...args) {
      const res = originalReplaceState.apply(this, args);
      handleLocationChange();
      return res;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Hotkey for Hotel Malabar Management: Alt + Shift + A (or Ctrl + Shift + A)
      if ((e.altKey || e.ctrlKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        window.history.pushState({}, '', '/admin/login');
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const navigateToCustomer = () => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname.startsWith('/admin')) {
        window.history.pushState({}, '', '/');
      } else if (window.location.hash.includes('admin')) {
        window.location.hash = '';
      }
    }
    setViewMode('customer');
  };

  // Customer authentication state
  const [customerUser, setCustomerUser] = useState<User | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | undefined>(undefined);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');

  // Menu & Settings
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings>({
    freeDeliveryKm: 2,
    perKmCharge: 50,
    minOrderAmount: 200,
    isServiceActive: true,
    defaultPrepTimeMinutes: 10,
  });
  const [deliveryAreas, setDeliveryAreas] = useState<DeliveryArea[]>([]);

  // Cart state (stored in session/local state)
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Active tracking order & order history
  const [activeTrackingOrderId, setActiveTrackingOrderId] = useState<string | null>(null);
  const [isOrderHistoryOpen, setIsOrderHistoryOpen] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);

  // 1. Verify saved customer session on boot
  useEffect(() => {
    let isMounted = true;
    const savedToken = localStorage.getItem('hm_customer_token');
    if (savedToken) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('Session expired');
        })
        .then((data) => {
          if (isMounted) {
            setCustomerUser(data.user);
            setCustomerProfile(data.profile);
          }
        })
        .catch(() => {
          if (isMounted) {
            localStorage.removeItem('hm_customer_token');
            setCustomerUser(null);
            setCustomerProfile(undefined);
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Load menu and delivery settings
  useEffect(() => {
    fetchMenuAndSettings();
  }, []);

  const fetchMenuAndSettings = async () => {
    try {
      const [menuRes, settingsRes] = await Promise.all([
        fetch('/api/menu'),
        fetch('/api/settings'),
      ]);

      if (menuRes.ok) {
        const mData = await menuRes.json();
        setCategories(mData.categories || []);
        setMenuItems(mData.items || []);
      }
      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        setDeliverySettings(sData.deliverySettings);
        setDeliveryAreas(sData.deliveryAreas || []);
      }
    } catch (err) {
      console.warn('Notice: Server initializing or network reconnecting:', err);
    }
  };

  // 3. Poll customer orders when logged in
  useEffect(() => {
    if (!customerUser) return;

    let isMounted = true;
    const fetchCustomerOrders = async () => {
      const token = localStorage.getItem('hm_customer_token');
      if (!token) return;
      try {
        const res = await fetch('/api/orders', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!isMounted) return;
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setCustomerOrders(data);
          }
        } else if (res.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('hm_customer_token');
          if (isMounted) {
            setCustomerUser(null);
            setCustomerProfile(undefined);
          }
        }
      } catch (err) {
        // Handle transient network/restart disconnects gracefully
        console.warn('Orders poll: waiting for connection...');
      }
    };

    fetchCustomerOrders();
    const interval = setInterval(fetchCustomerOrders, 6000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [customerUser]);

  // Handle Auth Success
  const handleAuthSuccess = (token: string, user: User) => {
    localStorage.setItem('hm_customer_token', token);
    setCustomerUser(user);
    setAuthModalOpen(false);
    fetchMenuAndSettings();
  };

  const handleLogout = () => {
    localStorage.removeItem('hm_customer_token');
    setCustomerUser(null);
    setCustomerProfile(undefined);
    setCartItems([]);
    setActiveTrackingOrderId(null);
  };

  // Cart operations
  const handleAddToCart = (item: MenuItem) => {
    setCartItems((prev) => {
      const existing = prev.find((ci) => ci.menuItem.id === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.menuItem.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [...prev, { menuItem: item, quantity: 1 }];
    });
  };

  const handleUpdateCartQuantity = (itemId: string, delta: number) => {
    setCartItems((prev) => {
      return prev
        .map((ci) => {
          if (ci.menuItem.id === itemId) {
            const newQty = ci.quantity + delta;
            return newQty > 0 ? { ...ci, quantity: newQty } : null;
          }
          return ci;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const handleRemoveCartItem = (itemId: string) => {
    setCartItems((prev) => prev.filter((ci) => ci.menuItem.id !== itemId));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const handleOrderPlaced = (newOrder: Order) => {
    setActiveTrackingOrderId(newOrder.id);
    setCustomerOrders((prev) => [newOrder, ...prev]);
  };

  // Cart calculations
  const cartTotalItemsCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartFoodTotal = cartItems.reduce(
    (sum, item) => sum + item.menuItem.price * item.quantity,
    0
  );
  const activeOrdersCount = customerOrders.filter((o) =>
    ['Order Placed', 'Accepted', 'Preparing', 'Ready', 'Out for Delivery'].includes(o.status)
  ).length;

  // Category item counts
  const categoryCounts: Record<string, number> = {};
  menuItems.forEach((item) => {
    categoryCounts[item.categoryId] = (categoryCounts[item.categoryId] || 0) + 1;
  });

  // Filtered Menu Items
  const filteredMenuItems = menuItems.filter((item) => {
    if (selectedCategoryId !== 'all' && item.categoryId !== selectedCategoryId) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      return matchName || matchDesc;
    }
    return true;
  });

  // =========================================================================
  // VIEW ROUTING
  // =========================================================================

  // If Admin View is active, render Admin Dashboard (handles its own isolated login & dashboard)
  if (viewMode === 'admin') {
    return <AdminDashboard onBackToCustomerSite={navigateToCustomer} />;
  }

  // If Customer is NOT authenticated: SHOW FIRST SCREEN / SPLASH SCREEN (Requirement 1, 2, 3)
  // Strict rule: "If the customer is not logged in: DO NOT show the food menu, DO NOT allow ordering"
  if (!customerUser) {
    return (
      <>
        <CustomerFirstScreen
          onCreateAccount={() => {
            setAuthInitialMode('register');
            setAuthModalOpen(true);
          }}
          onLogin={() => {
            setAuthInitialMode('login');
            setAuthModalOpen(true);
          }}
        />

        <CustomerAuthModal
          isOpen={authModalOpen}
          initialMode={authInitialMode}
          onClose={() => setAuthModalOpen(false)}
          onAuthSuccess={handleAuthSuccess}
        />
      </>
    );
  }

  // =========================================================================
  // AUTHENTICATED CUSTOMER PORTAL & FOOD MENU
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#0a1f13] text-[#fcfaf6] flex flex-col font-sans selection:bg-[#cba135] selection:text-[#0a1f13]">
      {/* Customer Header */}
      <CustomerHeader
        user={customerUser}
        cartCount={cartTotalItemsCount}
        cartTotal={cartFoodTotal}
        activeOrdersCount={activeOrdersCount}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenOrders={() => setIsOrderHistoryOpen(true)}
        onLogout={handleLogout}
      />

      {/* Category Pills Filter */}
      <CategoryFilter
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={setSelectedCategoryId}
        categoryCounts={categoryCounts}
      />

      {/* Main Menu Feed */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 sm:py-8">
        {/* RESTAURANT CLOSED BANNER */}
        {!deliverySettings.isRestaurantOpen && (
          <div className="mb-6 p-4 bg-gradient-to-r from-red-950 via-[#2d0f0f] to-red-950 border-2 border-red-500/80 rounded-2xl shadow-xl flex items-center gap-3.5 text-red-200">
            <div className="w-10 h-10 rounded-xl bg-red-900/80 border border-red-400 flex items-center justify-center text-red-300 shrink-0 font-bold">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  RESTAURANT CLOSED — Online Ordering Paused
                </h3>
                <span className="text-[10px] bg-red-800/80 text-white font-mono px-2 py-0.5 rounded font-bold">
                  {deliverySettings.manualStatus === 'closed'
                    ? 'Closed by Admin'
                    : `Closed (Hours: ${deliverySettings.openingTime || '07:00'} - ${deliverySettings.closingTime || '22:00'} IST)`}
                </span>
              </div>
              <p className="text-xs text-red-300 mt-0.5">
                We are currently not accepting new online orders. You can browse our authentic Kerala menu; checkout will resume when the restaurant reopens.
              </p>
            </div>
          </div>
        )}

        {/* Selected Category is Closed Notice */}
        {selectedCategoryId !== 'all' && categories.find((c) => c.id === selectedCategoryId)?.isActive === false && (
          <div className="mb-6 p-3.5 bg-amber-950/70 border border-amber-600/70 rounded-2xl shadow flex items-center gap-3 text-amber-200 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <strong className="block text-white text-xs font-bold uppercase tracking-wider">
                Category Currently Unavailable
              </strong>
              <span>Dishes in this category cannot be ordered right now. All other open categories remain active!</span>
            </div>
          </div>
        )}

        {/* Active tracking banner if an order is active */}
        {activeOrdersCount > 0 && customerOrders[0] && (
          <div
            onClick={() => setActiveTrackingOrderId(customerOrders[0].id)}
            className="mb-6 p-4 bg-gradient-to-r from-[#143d26] via-[#1a4f32] to-[#143d26] border-2 border-[#dfb64c] rounded-2xl shadow-xl flex items-center justify-between gap-3 cursor-pointer hover:scale-[1.01] transition-transform animate-pulse"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#dfb64c] text-[#0a1f13] flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-mono font-bold text-[#dfb64c]">
                  ACTIVE ORDER {customerOrders[0].orderNumber}
                </span>
                <h4 className="text-sm font-semibold text-[#fcfaf6]">
                  Status: {customerOrders[0].status}
                  {customerOrders[0].estimatedPrepTimeMinutes &&
                    ` • Approx ${customerOrders[0].estimatedPrepTimeMinutes} mins remaining`}
                </h4>
              </div>
            </div>
            <span className="bg-[#0a1f13] text-[#dfb64c] text-xs font-semibold px-3 py-1.5 rounded-xl border border-[#cba135]/50">
              Track Live →
            </span>
          </div>
        )}

        {/* Section Heading */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="font-brand text-2xl sm:text-3xl font-bold text-[#fcfaf6]">
              {selectedCategoryId === 'all'
                ? 'Authentic Malabar Menu'
                : categories.find((c) => c.id === selectedCategoryId)?.name || 'Food Menu'}
            </h2>
            <p className="text-xs text-[#8ea896] mt-0.5">
              Freshly prepared with authentic Kerala spices and coastal recipes.
            </p>
          </div>

          <span className="text-xs text-[#c9dcce] bg-[#113320] border border-[#214f34] px-3 py-1.5 rounded-full">
            Showing {filteredMenuItems.length} dishes
          </span>
        </div>

        {/* Food Items Grid */}
        {filteredMenuItems.length === 0 ? (
          <div className="bg-[#0f2d1c] border border-[#235836] rounded-2xl p-12 text-center text-[#8ea896] my-8">
            <p className="text-base font-semibold text-[#fcfaf6] mb-1">No food items found</p>
            <p className="text-xs">
              Try searching for a different dish name or switch categories.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {filteredMenuItems.map((item) => {
              const cat = categories.find((c) => c.id === item.categoryId);
              const cartItem = cartItems.find((ci) => ci.menuItem.id === item.id);
              const qty = cartItem ? cartItem.quantity : 0;

              return (
                <FoodCard
                  key={item.id}
                  item={item}
                  categoryName={cat?.name}
                  cartQuantity={qty}
                  isRestaurantOpen={deliverySettings.isRestaurantOpen}
                  isCategoryOpen={cat?.isActive !== false}
                  onAddToCart={handleAddToCart}
                  onUpdateQuantity={handleUpdateCartQuantity}
                />
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar (Mobile-friendly summary when cart has items) */}
      {cartItems.length > 0 && !isCartOpen && (
        <div className="fixed bottom-4 inset-x-4 max-w-lg mx-auto z-30">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-gradient-to-r from-[#dfb64c] to-[#cba135] text-[#0a1f13] font-bold py-3.5 px-5 rounded-2xl shadow-2xl flex items-center justify-between gap-2 hover:from-[#ecd06b] transition-all cursor-pointer transform hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-2">
              <span className="bg-[#0a1f13] text-[#dfb64c] text-xs font-mono font-bold px-2.5 py-1 rounded-lg">
                {cartTotalItemsCount} {cartTotalItemsCount === 1 ? 'item' : 'items'}
              </span>
              <span className="text-sm font-semibold">View Order Cart</span>
            </div>

            <div className="flex items-center gap-1.5 font-mono text-base">
              <span>₹{cartFoodTotal}</span>
              <span className="text-xs font-sans">→</span>
            </div>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      <CustomerCartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        deliverySettings={deliverySettings}
        deliveryAreas={deliveryAreas}
        user={customerUser}
        profile={customerProfile}
        isRestaurantOpen={deliverySettings.isRestaurantOpen}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
        onOrderPlaced={handleOrderPlaced}
      />

      {/* Live Order Status Modal */}
      {activeTrackingOrderId && (
        <OrderStatusView
          orderId={activeTrackingOrderId}
          onClose={() => setActiveTrackingOrderId(null)}
        />
      )}

      {/* Order History Modal */}
      <CustomerOrderHistory
        isOpen={isOrderHistoryOpen}
        onClose={() => setIsOrderHistoryOpen(false)}
        onSelectOrder={(orderId) => {
          setIsOrderHistoryOpen(false);
          setActiveTrackingOrderId(orderId);
        }}
      />

      {/* Footer */}
      <footer className="bg-[#07170e] border-t border-[#163823] text-xs text-[#8ea896] py-8 px-4 mt-12">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left select-none cursor-default">
            <h4 className="font-brand font-bold text-sm text-[#fdfbf7]">HOTEL MALABAR</h4>
            <p className="text-[11px] text-[#789682] mt-0.5">
              Authentic Kerala & Coastal Delicacies • Bommasandra / Electronic City
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px]">
            <span>Hotlines: 9567562071 / 8904634717</span>
            <span>•</span>
            <span>100% Cash on Delivery</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
