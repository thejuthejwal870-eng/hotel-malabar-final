import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Printer,
  Utensils,
  Truck,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Edit2,
  Trash2,
  Search,
  Upload,
  RefreshCw,
  LogOut,
  AlertTriangle,
  FileText,
  Volume2,
  VolumeX,
  Eye,
  Sliders,
  ArrowLeft,
  ChevronDown,
  MapPin,
  ExternalLink,
  Share2,
  Copy,
  Building,
  Layers,
  ArrowUp,
  ArrowDown,
  Camera,
  ShieldCheck,
  Lock,
  Menu as MenuIcon,
  X as XIcon,
} from 'lucide-react';
import {
  Order,
  OrderStatus,
  MenuItem,
  MenuCategory,
  DeliverySettings,
  DeliveryArea,
  RestaurantProfile,
} from '../types';
import { WatermarkedImage } from './WatermarkedImage';
import { applyWatermarkToImageFile, EXACT_WATERMARK_TEXT } from '../utils/watermark';
import { playNewOrderChime, playTestChime, unlockAudio } from '../utils/audio';
import { printThermalOrder } from '../utils/thermalPrinter';
import { AdminProfileManager } from './AdminProfileManager';
import { AdminCategoryManager } from './AdminCategoryManager';

interface AdminDashboardProps {
  onBackToCustomerSite: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToCustomerSite }) => {
  // Auth state - strictly secure, no credentials hardcoded in frontend
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [restaurantProfile, setRestaurantProfile] = useState<RestaurantProfile | null>(null);

  // Navigation tab & mobile sidebar drawer
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'categories' | 'profile' | 'delivery' | 'customers'>('orders');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Data states
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings>({
    freeDeliveryKm: 2,
    perKmCharge: 50,
    minOrderAmount: 200,
    isServiceActive: true,
    defaultPrepTimeMinutes: 10,
  });
  const [deliveryAreas, setDeliveryAreas] = useState<DeliveryArea[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  // Sound & Auto-print settings
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hm_admin_sound_muted');
      return saved !== 'true';
    }
    return true;
  });
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const [repeatSoundUntilAccepted, setRepeatSoundUntilAccepted] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hm_admin_repeat_sound') === 'true';
    }
    return false;
  });
  const repeatSoundRef = useRef(repeatSoundUntilAccepted);
  useEffect(() => {
    repeatSoundRef.current = repeatSoundUntilAccepted;
  }, [repeatSoundUntilAccepted]);

  // Audio alert banner for latest received order
  const [audioAlertBanner, setAudioAlertBanner] = useState<{
    orderId: string;
    orderNumber: string;
    time: string;
  } | null>(null);

  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false);
  const [printPaperWidth, setPrintPaperWidth] = useState<'58mm' | '80mm'>('58mm');
  const [printType, setPrintType] = useState<'KOT' | 'BILL'>('KOT');
  const [selectedOrderForKOT, setSelectedOrderForKOT] = useState<Order | null>(null);

  // Filters & Search
  const [orderFilter, setOrderFilter] = useState<'all' | 'new' | 'active' | 'completed' | 'rejected'>('all');
  const [customerSearch, setCustomerSearch] = useState('');
  const [menuSearch, setMenuSearch] = useState('');
  const [selectedMenuCategory, setSelectedMenuCategory] = useState<string>('all');

  // Modals
  const [prepTimeModalOrder, setPrepTimeModalOrder] = useState<Order | null>(null);
  const [selectedPrepMinutes, setSelectedPrepMinutes] = useState(15);
  const [customPrepMinutes, setCustomPrepMinutes] = useState('');
  const [adminClock, setAdminClock] = useState<number>(Date.now());

  // 1-second live ticker for remaining time display
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setAdminClock(Date.now());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemForm, setItemForm] = useState({
    name: '',
    categoryId: '',
    price: '',
    description: '',
    imageUrl: '',
    isVeg: false,
    isAvailable: true,
    prepTimeMinutes: '10',
  });
  const [imageUploading, setImageUploading] = useState(false);

  const [customerOrdersModal, setCustomerOrdersModal] = useState<any | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // Track previous orders to alert on genuine new ones
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const isInitialOrderLoadRef = useRef<boolean>(true);
  const printedOrdersRef = useRef<Set<string>>(new Set());

  // Check saved admin token on mount and verify with backend
  useEffect(() => {
    const savedToken = localStorage.getItem('hm_admin_token');
    if (savedToken) {
      fetch('/api/admin/status', {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
        .then((res) => {
          if (res.ok) {
            setAdminToken(savedToken);
            setIsAdminLoggedIn(true);
          } else {
            localStorage.removeItem('hm_admin_token');
            setAdminToken(null);
            setIsAdminLoggedIn(false);
          }
        })
        .catch(() => {
          localStorage.removeItem('hm_admin_token');
          setAdminToken(null);
          setIsAdminLoggedIn(false);
        });
    }
  }, []);

  // Poll orders & data when logged in
  useEffect(() => {
    if (!isAdminLoggedIn || !adminToken) return;

    fetchAllAdminData();
    const interval = setInterval(() => {
      fetchOrdersOnly();
    }, 4000);

    return () => clearInterval(interval);
  }, [isAdminLoggedIn, adminToken]);

  const fetchAllAdminData = async () => {
    if (!adminToken) return;
    try {
      const headers = { Authorization: `Bearer ${adminToken}` };

      const [ordersRes, menuRes, settingsRes, customersRes, profileRes] = await Promise.all([
        fetch('/api/admin/orders', { headers }),
        fetch('/api/menu'),
        fetch('/api/settings'),
        fetch('/api/admin/customers', { headers }),
        fetch('/api/profile'),
      ]);

      if (ordersRes.ok) {
        const oData = await ordersRes.json();
        handleOrdersUpdate(oData);
      }
      if (menuRes.ok) {
        const mData = await menuRes.json();
        setMenuItems(mData.items || []);
        setCategories(mData.categories || []);
      }
      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        setDeliverySettings(sData.deliverySettings);
        setDeliveryAreas(sData.deliveryAreas || []);
      }
      if (customersRes.ok) {
        const cData = await customersRes.json();
        setCustomers(
  cData.map((c: any) => ({
    ...c.user,
    profile: c.profile,
    totalOrders: c.ordersCount,
    totalSpent: c.totalSpent,
    createdAt: c.user?.createdAt,
  }))
);;
      }
      if (profileRes.ok) {
        const pData = await profileRes.json();
        setRestaurantProfile(pData);
      }
    } catch (err) {
      console.warn('Admin load data notice:', err);
    }
  };

  const fetchOrdersOnly = async () => {
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin/orders', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        handleOrdersUpdate(data);
      } else if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('hm_admin_token');
        setIsAdminLoggedIn(false);
        setAdminToken(null);
      }
    } catch (err) {
      console.warn('Admin order poll waiting for connection...');
    }
  };

  // Toggle audio notification mute/unmute
  const handleToggleSound = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    soundEnabledRef.current = nextState;
    if (typeof window !== 'undefined') {
      localStorage.setItem('hm_admin_sound_muted', String(!nextState));
    }
    if (nextState) {
      unlockAudio();
      playTestChime();
    }
  };

  // Test sound alert button
  const handleTestSoundAlert = () => {
    unlockAudio();
    playNewOrderChime();
  };

  // Toggle repeat sound reminder
  const handleToggleRepeatSound = () => {
    const next = !repeatSoundUntilAccepted;
    setRepeatSoundUntilAccepted(next);
    repeatSoundRef.current = next;
    if (typeof window !== 'undefined') {
      localStorage.setItem('hm_admin_repeat_sound', String(next));
    }
  };

  // Periodic sound reminder while there are unaccepted new orders (if repeat enabled)
  useEffect(() => {
    if (!isAdminLoggedIn) return;

    const reminderInterval = setInterval(() => {
      if (repeatSoundRef.current && soundEnabledRef.current) {
        const hasUnacceptedOrders = orders.some((o) => o.status === 'Order Placed');
        if (hasUnacceptedOrders) {
          unlockAudio();
          playNewOrderChime(0.6);
        }
      }
    }, 20000);

    return () => clearInterval(reminderInterval);
  }, [isAdminLoggedIn, orders]);

  const handleOrdersUpdate = (newOrders: Order[]) => {
    setOrders(newOrders);

    const currentIds = new Set(newOrders.map((o) => o.id));

    // First time loading orders: record existing IDs without triggering false alarm chime
    if (isInitialOrderLoadRef.current) {
      knownOrderIdsRef.current = currentIds;
      isInitialOrderLoadRef.current = false;
      return;
    }

    // Detect genuine newly received orders (status: Order Placed and not previously seen)
    const brandNewPlacedOrders = newOrders.filter(
      (o) => o.status === 'Order Placed' && !knownOrderIdsRef.current.has(o.id)
    );

    if (brandNewPlacedOrders.length > 0) {
      const latestNewOrder = brandNewPlacedOrders[0];

      // Play audio chime if sound is enabled (not muted)
      if (soundEnabledRef.current) {
        unlockAudio();
        playNewOrderChime();
      }

      // Show temporary audio alert indicator banner
      setAudioAlertBanner({
        orderId: latestNewOrder.id,
        orderNumber: latestNewOrder.orderNumber,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });

      // Auto-print if enabled and not already printed
      if (autoPrintEnabled) {
        if (!printedOrdersRef.current.has(latestNewOrder.id)) {
          printedOrdersRef.current.add(latestNewOrder.id);
          triggerThermalPrint(latestNewOrder);
        }
      }
    }

    knownOrderIdsRef.current = currentIds;
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const cleanPhone = adminPhone.trim();
    if (!cleanPhone) {
      setLoginError('Please enter an authorized admin phone number.');
      return;
    }

    if (!['9567562071', '8904634717', '9538950224'].includes(cleanPhone)) {
      setLoginError('Unauthorized Admin Number');
      return;
    }

    setLoginLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unauthorized Admin Number');
      }

      localStorage.setItem('hm_admin_token', data.token);
      setAdminToken(data.token);
      setIsAdminLoggedIn(true);
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', '/admin');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Unauthorized Admin Number');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('hm_admin_token');
    setAdminToken(null);
    setIsAdminLoggedIn(false);
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/admin/login');
    }
  };

  const handleSetRestaurantManualStatus = async (status: 'auto' | 'open' | 'closed') => {
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin/restaurant/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ manualStatus: status }),
      });
      if (res.ok) {
        const data = await res.json();
        setDeliverySettings(data.deliverySettings);
        if (restaurantProfile) {
          setRestaurantProfile({
            ...restaurantProfile,
            isOnlineOrderOpen: data.deliverySettings.isRestaurantOpen,
          });
        }
      }
    } catch (err) {
      console.error('Failed to set restaurant status:', err);
    }
  };

  const handleToggleRestaurantOpenStatus = async () => {
    if (!adminToken) return;
    const currentIsOpen = deliverySettings?.isRestaurantOpen !== false;
    const nextStatus: 'open' | 'closed' = currentIsOpen ? 'closed' : 'open';
    await handleSetRestaurantManualStatus(nextStatus);
  };

  // Order Actions
  const handleAcceptOrderClick = (order: Order) => {
    setPrepTimeModalOrder(order);
    setSelectedPrepMinutes(order.preparationMinutes || order.estimatedPrepTimeMinutes || 15);
    setCustomPrepMinutes('');
  };

  const handleConfirmAccept = async () => {
    if (!prepTimeModalOrder || !adminToken) return;

    const prepTime = customPrepMinutes
      ? parseInt(customPrepMinutes, 10)
      : selectedPrepMinutes;

    const finalMins = prepTime && !isNaN(prepTime) && prepTime > 0 ? prepTime : 15;

    try {
      const isNew = prepTimeModalOrder.status === 'Order Placed';
      const endpoint = isNew
        ? `/api/admin/orders/${prepTimeModalOrder.id}/status`
        : `/api/admin/orders/${prepTimeModalOrder.id}/prep-time`;

      const payload = isNew
        ? {
            status: 'Accepted',
            estimatedPrepTimeMinutes: finalMins,
            preparationMinutes: finalMins,
          }
        : {
            preparationMinutes: finalMins,
          };

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setPrepTimeModalOrder(null);
        fetchOrdersOnly();
      }
    } catch (err) {
      console.error('Failed to set prep time:', err);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    if (!adminToken) return;

    const payload: any = { status: newStatus };

    if (newStatus === 'Order Rejected') {
      const reason = window.prompt(
        'Please enter rejection reason for the customer (optional):',
        'Kitchen capacity reached / Item unavailable'
      );
      if (reason === null) return; // Cancelled
      payload.rejectionReason = reason.trim() || 'Kitchen capacity reached';
    }

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        fetchOrdersOnly();
      }
    } catch (err) {
      console.error('Status update failed:', err);
    }
  };

  // Location & Sharing Helpers
  const handleShareWhatsApp = (order: Order) => {
    const mapsUrl =
      order.googleMapsUrl ||
      (order.customerLatitude && order.customerLongitude
        ? `https://www.google.com/maps?q=${order.customerLatitude},${order.customerLongitude}`
        : '');

    const lines = [
      `*HOTEL MALABAR - ORDER ${order.orderNumber}*`,
      `--------------------------------`,
      `*Customer:* ${order.customerName}`,
      `*Phone:* ${order.customerPhone}`,
      `*Delivery Area:* ${order.deliveryArea} (${order.deliveryDistanceKm} km)`,
      `*Address:* ${order.deliveryAddress}`,
    ];

    if (order.specialInstructions && order.specialInstructions.trim()) {
      lines.push(`*Special Instructions:* ${order.specialInstructions.trim()}`);
    } else {
      lines.push(`*Special Instructions:* No special instructions`);
    }

    if (order.customerLatitude && order.customerLongitude) {
      lines.push(`--------------------------------`);
      lines.push(`📍 *Customer Location (GPS):*`);
      lines.push(`*Coordinates:* ${order.customerLatitude}, ${order.customerLongitude}`);
      lines.push(`*Google Maps:* ${mapsUrl}`);
    }

    lines.push(`--------------------------------`);
    lines.push(`*Items:*`);
    order.items.forEach((item) => {
      lines.push(`• ${item.quantity}x ${item.itemName} - ₹${item.subtotal}`);
    });
    lines.push(`--------------------------------`);
    lines.push(`*Food Total:* ₹${order.foodTotal}`);
    lines.push(`*Delivery Charge:* ₹${order.deliveryCharge}`);
    lines.push(`*Grand Total (COD):* ₹${order.grandTotal}`);
    lines.push(`*Status:* ${order.status}`);

    const text = lines.join('\n');
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleCopyMapsLink = (order: Order) => {
    const url =
      order.googleMapsUrl ||
      (order.customerLatitude && order.customerLongitude
        ? `https://www.google.com/maps?q=${order.customerLatitude},${order.customerLongitude}`
        : '');
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedOrderId(order.id);
      setTimeout(() => setCopiedOrderId(null), 2500);
    });
  };

  // Thermal Printing
  const triggerThermalPrint = (order: Order, type: 'KOT' | 'BILL' = 'KOT') => {
    setPrintType(type);
    setSelectedOrderForKOT(order);
    printThermalOrder(order, {
      type,
      paperWidth: printPaperWidth,
      restaurantName: restaurantProfile?.name || 'HOTEL MALABAR',
      phones: restaurantProfile?.phones || ['9567562071', '8904634717'],
      address: restaurantProfile?.address || 'Authentic Kerala Cuisine, Main Road, Sulthan Bathery, Wayanad',
    });
  };

  // Menu Image Upload with automated watermark baking
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImageUploading(true);
      // Automatically bakes "This is made by INSTA ID @thee.juuu" onto canvas!
      const watermarkedBase64 = await applyWatermarkToImageFile(file);
      setItemForm((prev) => ({ ...prev, imageUrl: watermarkedBase64 }));
    } catch (err) {
      alert('Failed to apply watermark to uploaded photo. Please try again.');
    } finally {
      setImageUploading(false);
    }
  };

  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;

    try {
      const payload = {
        name: itemForm.name.trim(),
        categoryId: itemForm.categoryId || categories[0]?.id,
        price: parseFloat(itemForm.price),
        description: itemForm.description.trim(),
        imageUrl: itemForm.imageUrl,
        isVeg: itemForm.isVeg,
        isAvailable: itemForm.isAvailable,
        prepTimeMinutes: parseInt(itemForm.prepTimeMinutes, 10) || 10,
      };

      const url = editingItem
        ? `/api/admin/menu/items/${editingItem.id}`
        : '/api/admin/menu/items';
      const method = editingItem ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setItemModalOpen(false);
        setEditingItem(null);
        fetchAllAdminData();
      }
    } catch (err) {
      console.error('Failed to save menu item:', err);
    }
  };

  const handleDeleteMenuItem = async (id: string) => {
    if (!adminToken || !confirm('Are you sure you want to delete this menu item?')) return;
    try {
      const res = await fetch(`/api/admin/menu/items/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        fetchAllAdminData();
      }
    } catch (err) {
      console.error('Delete item error:', err);
    }
  };

  const handleToggleItemAvailability = async (item: MenuItem) => {
    if (!adminToken) return;
    try {
      await fetch(`/api/admin/menu/items/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ isAvailable: !item.isAvailable }),
      });
      fetchAllAdminData();
    } catch (err) {
      console.error('Failed to toggle availability:', err);
    }
  };

  const [quickPhotoLoadingId, setQuickPhotoLoadingId] = useState<string | null>(null);

  const handleMoveMenuItem = async (id: string, direction: 'up' | 'down') => {
    if (!adminToken) return;
    try {
      const res = await fetch(`/api/admin/menu/items/${id}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ direction }),
      });
      if (res.ok) {
        fetchAllAdminData();
      }
    } catch (err) {
      console.error('Failed to move item:', err);
    }
  };

  const handleQuickPhotoReplace = async (item: MenuItem, file: File) => {
    if (!adminToken || !file) return;
    try {
      setQuickPhotoLoadingId(item.id);
      const watermarkedBase64 = await applyWatermarkToImageFile(file);
      const res = await fetch(`/api/admin/menu/items/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ imageUrl: watermarkedBase64 }),
      });
      if (res.ok) {
        fetchAllAdminData();
      }
    } catch (err) {
      alert('Failed to update photo with watermark. Please try another image.');
    } finally {
      setQuickPhotoLoadingId(null);
    }
  };

  // Delivery Settings Update
  const handleSaveDeliverySettings = async () => {
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          deliverySettings,
          deliveryAreas,
        }),
      });
      if (res.ok) {
        alert('Hotel Malabar delivery settings saved successfully.');
      }
    } catch (err) {
      alert('Failed to update settings');
    }
  };

  // ==========================================
  // RENDER LOGIN IF NOT AUTHENTICATED
  // ==========================================
  if (!isAdminLoggedIn) {
    return (
      <div className="min-h-screen bg-[#091a10] text-[#fcfaf6] flex flex-col justify-center items-center p-4 selection:bg-[#cba135] selection:text-[#0a1f13]">
        <div className="w-full max-w-md bg-[#0f2d1c] border-2 border-[#cba135] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-[#164027] border border-[#dfb64c] rounded-2xl mx-auto flex items-center justify-center text-[#dfb64c] shadow-lg">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="font-brand text-2xl sm:text-3xl font-bold text-[#fcfaf6]">
              Private Admin Portal
            </h1>
            <p className="text-xs text-[#9bb5a4]">
              Hotel Malabar Kitchen, Menu & Delivery Control Terminal
            </p>
          </div>

          {/* Authorized Numbers Notice */}
          <div className="bg-[#123620] border border-[#245937] rounded-2xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between text-[#dfb64c] font-semibold text-[11px]">
              <span>Authorized Admin Numbers</span>
              <span className="bg-[#091a10] px-2 py-0.5 rounded text-[10px] text-emerald-400 font-bold">No OTP</span>
            </div>
            <p className="text-[11px] text-[#8ea896] leading-relaxed">
              Administrative access is strictly restricted to designated phone accounts:
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {['9567562071', '8904634717', '9538950224'].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    setAdminPhone(num);
                    setLoginError(null);
                  }}
                  className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    adminPhone === num
                      ? 'bg-[#dfb64c] text-[#0a1f13] border-[#dfb64c] font-bold shadow'
                      : 'bg-[#0b2114] text-[#c9dcce] border-[#1d4c2e] hover:border-[#dfb64c]'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-[#8ea896] pt-0.5 italic">
              Click a number above to autofill, or enter directly below.
            </p>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl bg-red-950/90 border border-red-800 text-red-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="font-semibold">{loginError}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#c9dcce] mb-1">
                Authorized Admin Phone Number
              </label>
              <input
                type="tel"
                required
                value={adminPhone}
                onChange={(e) => {
                  setAdminPhone(e.target.value);
                  setLoginError(null);
                }}
                placeholder="e.g. 9567562071"
                className="w-full bg-[#123620] border border-[#245937] rounded-xl px-3.5 py-2.5 text-sm text-[#fcfaf6] font-mono focus:outline-none focus:border-[#dfb64c]"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-gradient-to-r from-[#dfb64c] to-[#cba135] hover:from-[#e7c35d] text-[#0a1f13] font-bold py-3.5 rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50 mt-2 flex items-center justify-center gap-2 text-sm"
            >
              {loginLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Admin Phone...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Sign In as Admin</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={onBackToCustomerSite}
              className="text-xs text-[#dfb64c] hover:underline flex items-center justify-center gap-1 mx-auto cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Hotel Malabar Website</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Calculate filtered orders
  const newOrdersCount = orders.filter((o) => o.status === 'Order Placed').length;

  const filteredOrders = orders.filter((order) => {
    if (orderFilter === 'new') return order.status === 'Order Placed';
    if (orderFilter === 'active') {
      return ['Accepted', 'Preparing', 'Ready', 'Out for Delivery'].includes(order.status);
    }
    if (orderFilter === 'completed') return order.status === 'Delivered';
    if (orderFilter === 'rejected') return order.status === 'Order Rejected';
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0a1f13] text-[#fcfaf6] flex flex-col font-sans">
      {/* Top Admin Navigation Header */}
      <header className="bg-[#0f2d1c] border-b border-[#235836] sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Mobile Sidebar Hamburger Toggle */}
            <button
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              className="lg:hidden p-2 rounded-xl bg-[#164027] border border-[#2e6843] text-[#dfb64c] hover:text-white transition-colors cursor-pointer"
              title="Toggle Admin Menu Sidebar"
              aria-label="Toggle Admin Menu Sidebar"
            >
              {mobileSidebarOpen ? <XIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
            </button>

            <div className="w-10 h-10 rounded-xl bg-[#1b472e] border border-[#cba135] flex items-center justify-center text-[#dfb64c] shadow shrink-0">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-brand text-lg font-bold text-[#fcfaf6]">HOTEL MALABAR</span>
                <span className="bg-[#dfb64c] text-[#0a1f13] text-[9px] font-bold uppercase px-2 py-0.5 rounded font-mono">
                  Admin Terminal
                </span>
              </div>
              <span className="text-[11px] text-[#8ea896] hidden sm:inline">
                Authorized Management: 9567562071 / 8904634717 / 9538950224
              </span>
            </div>
          </div>

          {/* Quick Action Toggles & Links */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Restaurant Open / Closed Status & Manual Controls */}
            <div className="flex items-center gap-1.5 bg-[#091f13] border border-[#235836] p-1 rounded-xl">
              <div
                className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                  deliverySettings.isRestaurantOpen
                    ? 'bg-emerald-950 border border-emerald-500/60 text-emerald-300'
                    : 'bg-red-950 border border-red-500/60 text-red-300'
                }`}
                title={`Operating status: ${deliverySettings.isRestaurantOpen ? 'OPEN' : 'CLOSED'} (Mode: ${deliverySettings.manualStatus || 'auto'}).`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    deliverySettings.isRestaurantOpen ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
                  }`}
                />
                <span className="font-extrabold tracking-wide">
                  {deliverySettings.isRestaurantOpen ? 'OPEN' : 'CLOSED'}
                </span>
                <span className="text-[10px] text-stone-300 font-normal hidden lg:inline border-l border-stone-600 pl-1.5">
                  {deliverySettings.manualStatus === 'auto'
                    ? `Auto (${deliverySettings.openingTime || '07:00'}-${deliverySettings.closingTime || '22:00'})`
                    : deliverySettings.manualStatus === 'open'
                    ? 'Manual Open'
                    : 'Manual Closed'}
                </span>
              </div>

              {/* Explicit Action Buttons requested by user */}
              {deliverySettings.manualStatus !== 'open' && (
                <button
                  onClick={() => handleSetRestaurantManualStatus('open')}
                  className="px-2 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11px] transition-colors cursor-pointer"
                  title="Force OPEN restaurant immediately (Admin Manual Override)"
                >
                  OPEN
                </button>
              )}

              {deliverySettings.manualStatus !== 'closed' && (
                <button
                  onClick={() => handleSetRestaurantManualStatus('closed')}
                  className="px-2 py-1 rounded-lg bg-red-700 hover:bg-red-600 text-white font-bold text-[11px] transition-colors cursor-pointer"
                  title="Force CLOSE restaurant immediately (Admin Manual Override, e.g. food finished early)"
                >
                  CLOSE
                </button>
              )}

              {deliverySettings.manualStatus !== 'auto' && (
                <button
                  onClick={() => handleSetRestaurantManualStatus('auto')}
                  className="px-2 py-1 rounded-lg bg-[#143d26] hover:bg-[#1a4f32] text-[#dfb64c] border border-[#2e6b45] text-[10px] font-semibold transition-colors cursor-pointer"
                  title="Return to automatic schedule based on opening & closing time"
                >
                  AUTO
                </button>
              )}
            </div>

            {/* Audio Alert Chime Mute/Unmute Toggle */}
            <button
              onClick={handleToggleSound}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                soundEnabled
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 hover:bg-emerald-900/80 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                  : 'bg-red-950/70 border-red-500/80 text-red-300 hover:bg-red-900/70'
              }`}
              title={soundEnabled ? 'Audio alerts are ON. Click to MUTE sound.' : 'Audio alerts are MUTED. Click to UNMUTE sound.'}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
                  <span className="hidden sm:inline">Sound: ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="hidden sm:inline">Sound: MUTED</span>
                </>
              )}
            </button>

            {/* Test Chime Quick Button */}
            <button
              onClick={handleTestSoundAlert}
              className="p-1.5 sm:px-2 sm:py-1.5 rounded-xl border border-[#245937] bg-[#123620] hover:bg-[#184428] text-stone-300 hover:text-[#dfb64c] text-xs flex items-center gap-1 transition-all cursor-pointer"
              title="Test Order Bell Chime (Click to hear audio notification)"
            >
              <Bell className="w-3.5 h-3.5 text-[#dfb64c]" />
              <span className="hidden lg:inline text-[11px]">Test Bell</span>
            </button>

            {/* Auto Print KOT Toggle */}
            <button
              onClick={() => setAutoPrintEnabled(!autoPrintEnabled)}
              className={`p-2 rounded-xl border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                autoPrintEnabled
                  ? 'bg-[#dfb64c] border-[#dfb64c] text-[#0a1f13] font-bold'
                  : 'bg-[#123620] border-[#245937] text-[#c9dcce]'
              }`}
              title="Auto-trigger KOT print when new order arrives"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden xl:inline">Auto-KOT</span>
            </button>

            {/* Switch to Customer Site */}
            <button
              onClick={onBackToCustomerSite}
              className="bg-[#123620] hover:bg-[#184428] border border-[#245937] text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer text-[#dfb64c]"
              title="View customer-facing menu"
            >
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">Customer Site</span>
            </button>

            {/* Logout */}
            <button
              onClick={handleAdminLogout}
              className="p-2 text-red-400 hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer"
              title="Logout Admin"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Horizontal Quick Navigation Strip (visible on mobile only) */}
        <div className="lg:hidden flex items-center gap-1.5 px-3 py-2 overflow-x-auto border-t border-[#1a442b] bg-[#0c2417]">
          {[
            { id: 'orders', label: 'Orders', icon: Bell, count: newOrdersCount > 0 ? `${newOrdersCount} New` : orders.length },
            { id: 'menu', label: 'Food Menu', icon: Utensils, count: menuItems.length },
            { id: 'categories', label: 'Categories', icon: Layers, count: categories.length },
            { id: 'profile', label: 'Profile & Logo', icon: Building },
            { id: 'delivery', label: 'Delivery', icon: Truck, count: deliveryAreas.length },
            { id: 'customers', label: 'Customers', icon: Users, count: customers.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setMobileSidebarOpen(false);
                }}
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#dfb64c] text-[#0a1f13] font-bold shadow'
                    : 'bg-[#113320] text-[#a6bfae] hover:text-[#fcfaf6]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      tab.id === 'orders' && newOrdersCount > 0
                        ? 'bg-red-600 text-white animate-pulse'
                        : isActive
                        ? 'bg-[#0a1f13] text-[#dfb64c]'
                        : 'bg-[#1a472c] text-[#8ea896]'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Admin Dashboard Body with Sidebar */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* ========================================================================= */}
        {/* DESKTOP + MOBILE SLIDEOUT SIDEBAR NAVIGATION                              */}
        {/* ========================================================================= */}
        {/* Mobile Backdrop Overlay */}
        {mobileSidebarOpen && (
          <div
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          />
        )}

        <aside
          className={`fixed lg:sticky top-[58px] left-0 h-[calc(100vh-58px)] w-72 shrink-0 bg-[#0c2617] border-r border-[#1e4e30] flex flex-col justify-between p-4 z-40 transition-transform duration-300 lg:translate-x-0 ${
            mobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
          }`}
        >
          {/* Top Section of Sidebar */}
          <div className="space-y-4 overflow-y-auto pr-1">
            {/* Admin Identity Badge */}
            <div className="bg-[#113520] border border-[#235836] rounded-2xl p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#18482b] border border-[#dfb64c] flex items-center justify-center text-[#dfb64c] font-bold shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-[#fcfaf6] truncate">Authorized Admin</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <p className="text-[11px] font-mono text-[#dfb64c] truncate">
                  {adminPhone || '9567562071'}
                </p>
                <span className="text-[10px] text-[#8ea896] block">Hotel Malabar Operations</span>
              </div>
            </div>

            {/* Primary Navigation Menu */}
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#7e9e88] px-3 py-1">
                Management Console
              </div>

              {[
                {
                  id: 'orders',
                  label: 'Orders & Kitchen',
                  description: 'Accept/Reject, status, GPS, KOT print',
                  icon: Bell,
                  badge: newOrdersCount > 0 ? `${newOrdersCount} New` : `${orders.length} total`,
                  badgeColor: newOrdersCount > 0 ? 'bg-red-600 text-white animate-pulse' : 'bg-[#18482b] text-[#c9dcce]',
                },
                {
                  id: 'menu',
                  label: 'Food Menu & Dishes',
                  description: 'Add/Edit/Delete, price, photo, stock',
                  icon: Utensils,
                  badge: `${menuItems.length} dishes`,
                  badgeColor: 'bg-[#18482b] text-[#c9dcce]',
                },
                {
                  id: 'categories',
                  label: 'Menu Categories',
                  description: 'Add/Edit/Delete category structure',
                  icon: Layers,
                  badge: `${categories.length} cats`,
                  badgeColor: 'bg-[#18482b] text-[#c9dcce]',
                },
                {
                  id: 'profile',
                  label: 'Restaurant Profile',
                  description: 'Logo, photo, address, prep times',
                  icon: Building,
                  badge: restaurantProfile?.isOnlineOrderOpen !== false ? 'Open' : 'Closed',
                  badgeColor: restaurantProfile?.isOnlineOrderOpen !== false ? 'bg-emerald-950 text-emerald-400 border border-emerald-600' : 'bg-red-950 text-red-400 border border-red-600',
                },
                {
                  id: 'delivery',
                  label: 'Delivery & Zones',
                  description: 'Delivery radius, rates, km charges',
                  icon: Truck,
                  badge: `${deliveryAreas.length} zones`,
                  badgeColor: 'bg-[#18482b] text-[#c9dcce]',
                },
                {
                  id: 'customers',
                  label: 'Customer Directory',
                  description: 'Customer list, details, order history',
                  icon: Users,
                  badge: `${customers.length} users`,
                  badgeColor: 'bg-[#18482b] text-[#c9dcce]',
                },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as any);
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full text-left p-3 rounded-2xl transition-all cursor-pointer flex items-start gap-3 ${
                      isActive
                        ? 'bg-gradient-to-r from-[#17462a] to-[#1f5a36] border border-[#dfb64c] shadow-lg text-[#fcfaf6]'
                        : 'hover:bg-[#113620] text-[#a6bfae] hover:text-[#fcfaf6]'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isActive ? 'bg-[#dfb64c] text-[#0a1f13]' : 'bg-[#143d25] text-[#8ea896]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-xs font-bold ${isActive ? 'text-[#dfb64c]' : 'text-[#fcfaf6]'}`}>
                          {item.label}
                        </span>
                        {item.badge && (
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold shrink-0 ${item.badgeColor}`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#8ea896] truncate mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Controls inside Sidebar */}
          <div className="pt-4 border-t border-[#1e4e30] space-y-2 shrink-0">
            {/* Status Summary Widget */}
            <div className="bg-[#091e12] border border-[#1d462b] rounded-xl p-2.5 text-[11px] space-y-1 text-[#8ea896]">
              <div className="flex justify-between items-center">
                <span>Ordering Status:</span>
                <span className={`font-bold ${restaurantProfile?.isOnlineOrderOpen !== false ? 'text-emerald-400' : 'text-red-400'}`}>
                  {restaurantProfile?.isOnlineOrderOpen !== false ? 'ACTIVE' : 'PAUSED'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Default Prep:</span>
                <span className="font-mono text-[#dfb64c]">
                  {restaurantProfile?.defaultPrepTimeMinutes || 10} mins
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>KOT Format:</span>
                <span className="font-mono text-[#c9dcce]">{printPaperWidth}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-[#1d462b]/60">
                <span className="flex items-center gap-1">
                  {soundEnabled ? <Volume2 className="w-3 h-3 text-emerald-400" /> : <VolumeX className="w-3 h-3 text-red-400" />}
                  <span>Sound Alert:</span>
                </span>
                <button
                  onClick={handleToggleSound}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition-colors ${
                    soundEnabled
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-600 hover:bg-emerald-900'
                      : 'bg-red-950 text-red-300 border border-red-600 hover:bg-red-900'
                  }`}
                  title={soundEnabled ? 'Click to mute sound alert' : 'Click to unmute sound alert'}
                >
                  {soundEnabled ? 'ON (Mute)' : 'MUTED (Unmute)'}
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={onBackToCustomerSite}
                className="bg-[#123620] hover:bg-[#184428] border border-[#245937] text-xs font-semibold py-2 rounded-xl text-center text-[#dfb64c] cursor-pointer flex items-center justify-center gap-1"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Customer</span>
              </button>
              <button
                onClick={handleAdminLogout}
                className="bg-red-950/60 hover:bg-red-900/60 border border-red-800 text-xs font-semibold py-2 rounded-xl text-center text-red-300 cursor-pointer flex items-center justify-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </aside>

        {/* ========================================================================= */}
        {/* MAIN ADMIN DASHBOARD CONTENT AREA                                         */}
        {/* ========================================================================= */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
        {/* ========================================================================= */}
        {/* TAB 1: ORDERS & KITCHEN STATUS CONTROLLER                                */}
        {/* ========================================================================= */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            {/* AUDIO NOTIFICATION CONTROL & STATUS CARD */}
            <div className={`rounded-2xl border p-3.5 sm:p-4 transition-all ${
              soundEnabled
                ? 'bg-[#0b2416]/90 border-emerald-500/40 shadow-sm'
                : 'bg-[#1a1414]/90 border-red-500/40'
            }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    soundEnabled
                      ? 'bg-emerald-950 border border-emerald-500 text-emerald-400'
                      : 'bg-red-950 border border-red-500 text-red-400'
                  }`}>
                    {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs sm:text-sm font-bold text-[#fcfaf6]">
                        {soundEnabled ? 'Kitchen Order Bell: Sound Alert Active' : 'Kitchen Order Bell: Sound Muted'}
                      </h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        soundEnabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-red-500/20 text-red-300 border border-red-500/40'
                      }`}>
                        {soundEnabled ? 'ALERT: ON' : 'ALERT: MUTED'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8ea896] mt-0.5">
                      {soundEnabled
                        ? 'Rings an authentic 3-strike kitchen bell chime whenever a customer places an order.'
                        : 'Audio alerts are silenced. Toggle to unmute so you never miss an incoming order.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    onClick={handleToggleSound}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      soundEnabled
                        ? 'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-600'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-[#091a10] border border-emerald-400 shadow-md font-extrabold'
                    }`}
                  >
                    {soundEnabled ? (
                      <>
                        <VolumeX className="w-4 h-4 text-red-400" />
                        <span>Mute Sound</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4 text-[#091a10]" />
                        <span>Unmute Sound</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleTestSoundAlert}
                    className="bg-[#123620] hover:bg-[#184428] border border-[#dfb64c]/60 text-[#dfb64c] hover:text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Play restaurant kitchen bell alert chime now"
                  >
                    <Bell className="w-4 h-4 text-[#dfb64c]" />
                    <span>Test Chime</span>
                  </button>

                  <button
                    onClick={handleToggleRepeatSound}
                    className={`px-2.5 py-2 rounded-xl text-[11px] font-semibold border flex items-center gap-1 transition-all cursor-pointer ${
                      repeatSoundUntilAccepted
                        ? 'bg-[#dfb64c]/20 border-[#dfb64c] text-[#dfb64c]'
                        : 'bg-[#0d2215] border-[#1d462b] text-[#8ea896] hover:text-white'
                    }`}
                    title="Repeat bell alert chime every 20 seconds while unaccepted orders remain"
                  >
                    <span>Repeat until accepted:</span>
                    <span className="font-bold">{repeatSoundUntilAccepted ? 'ON' : 'OFF'}</span>
                  </button>
                </div>
              </div>

              {/* Real-time sound notification trigger banner */}
              {audioAlertBanner && (
                <div className="mt-3 pt-3 border-t border-[#1d462b] flex items-center justify-between gap-2 text-xs bg-emerald-950/80 border border-emerald-500/60 p-2.5 rounded-xl text-emerald-200">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                    <span>
                      🔔 Audio chime triggered at <span className="font-mono font-bold text-white">{audioAlertBanner.time}</span> for Order <span className="font-mono font-bold text-[#dfb64c]">#{audioAlertBanner.orderNumber}</span>
                    </span>
                  </div>
                  <button
                    onClick={() => setAudioAlertBanner(null)}
                    className="text-[11px] text-[#8ea896] hover:text-white underline cursor-pointer px-2 py-0.5"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>

            {/* NEW ORDER PROMINENT ALERT BANNER */}
            {newOrdersCount > 0 && (
              <div className="bg-gradient-to-r from-red-950 via-[#2d1111] to-red-950 border-2 border-red-500 rounded-2xl p-4 sm:p-5 shadow-2xl animate-pulse">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center font-bold">
                      <Bell className="w-5 h-5 animate-bounce" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-red-200">
                        {newOrdersCount} PENDING NEW ORDER{newOrdersCount > 1 ? 'S' : ''}!
                      </h2>
                      <p className="text-xs text-red-300">
                        Action required: Accept or Reject and notify customer with estimated prep time.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setOrderFilter('new')}
                    className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer shadow"
                  >
                    View New Orders
                  </button>
                </div>
              </div>
            )}

            {/* Orders Header & Filter Pills */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#1b432a]">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setOrderFilter('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${
                    orderFilter === 'all'
                      ? 'bg-[#dfb64c] text-[#0a1f13]'
                      : 'bg-[#123620] text-[#c9dcce] border border-[#245937]'
                  }`}
                >
                  All ({orders.length})
                </button>
                <button
                  onClick={() => setOrderFilter('new')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${
                    orderFilter === 'new'
                      ? 'bg-red-500 text-white font-bold'
                      : 'bg-[#123620] text-red-300 border border-[#245937]'
                  }`}
                >
                  New ({newOrdersCount})
                </button>
                <button
                  onClick={() => setOrderFilter('active')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${
                    orderFilter === 'active'
                      ? 'bg-[#dfb64c] text-[#0a1f13]'
                      : 'bg-[#123620] text-[#c9dcce] border border-[#245937]'
                  }`}
                >
                  Active in Kitchen (
                  {
                    orders.filter((o) =>
                      ['Accepted', 'Preparing', 'Ready', 'Out for Delivery'].includes(o.status)
                    ).length
                  }
                  )
                </button>
                <button
                  onClick={() => setOrderFilter('completed')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${
                    orderFilter === 'completed'
                      ? 'bg-emerald-500 text-[#0a1f13] font-bold'
                      : 'bg-[#123620] text-emerald-300 border border-[#245937]'
                  }`}
                >
                  Delivered ({orders.filter((o) => o.status === 'Delivered').length})
                </button>
                <button
                  onClick={() => setOrderFilter('rejected')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${
                    orderFilter === 'rejected'
                      ? 'bg-stone-500 text-white'
                      : 'bg-[#123620] text-stone-400 border border-[#245937]'
                  }`}
                >
                  Rejected ({orders.filter((o) => o.status === 'Order Rejected').length})
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-[#8ea896]">
                <span>Printer Width:</span>
                <select
                  value={printPaperWidth}
                  onChange={(e: any) => setPrintPaperWidth(e.target.value)}
                  className="bg-[#123620] border border-[#245937] rounded-lg px-2 py-1 text-xs text-[#fcfaf6]"
                >
                  <option value="58mm">58mm Thermal</option>
                  <option value="80mm">80mm Thermal</option>
                </select>
              </div>
            </div>

            {/* Orders Grid */}
            {filteredOrders.length === 0 ? (
              <div className="bg-[#0e2a1b] border border-[#1b432a] rounded-2xl p-12 text-center text-[#8ea896]">
                <FileText className="w-10 h-10 text-[#214e32] mx-auto mb-2" />
                <p className="text-base font-semibold text-[#fcfaf6]">No orders in this view</p>
                <p className="text-xs mt-1">Orders placed by customers will show up here automatically.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredOrders.map((order) => {
                  const isNew = order.status === 'Order Placed';
                  const orderDate = new Date(order.createdAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  });

                  return (
                    <div
                      key={order.id}
                      className={`bg-[#0f2d1c] border-2 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between transition-all ${
                        isNew
                          ? 'border-red-500 ring-2 ring-red-500/40'
                          : 'border-[#235836] hover:border-[#dfb64c]/60'
                      }`}
                    >
                      <div>
                        {/* Order Header info */}
                        <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#1b432a]">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-base text-[#dfb64c]">
                                {order.orderNumber}
                              </span>
                              <span className="text-xs text-[#8ea896] font-mono">
                                ({orderDate})
                              </span>
                            </div>
                            <h3 className="font-semibold text-sm sm:text-base text-[#fcfaf6] mt-0.5">
                              {order.customerName}
                            </h3>
                            <a
                              href={`tel:${order.customerPhone}`}
                              className="text-xs text-[#a6bfae] font-mono hover:text-[#dfb64c]"
                            >
                              📞 {order.customerPhone}
                            </a>
                          </div>

                          <div className="text-right">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-bold block ${
                                isNew
                                  ? 'bg-red-500 text-white animate-pulse'
                                  : order.status === 'Delivered'
                                  ? 'bg-emerald-950 border border-emerald-500 text-emerald-300'
                                  : order.status === 'Order Rejected'
                                  ? 'bg-stone-900 border border-stone-700 text-stone-400'
                                  : 'bg-[#143d26] border border-[#dfb64c] text-[#dfb64c]'
                              }`}
                            >
                              {order.status}
                            </span>
                            <span className="text-[11px] text-[#8ea896] block mt-1">
                              {order.deliveryArea} ({order.deliveryDistanceKm} km)
                            </span>
                          </div>
                        </div>

                        {/* Delivery Address & Special Instructions */}
                        <div className="py-2.5 text-xs text-[#c9dcce] border-b border-[#1b432a] space-y-2">
                          <div>
                            <span className="text-[#8ea896] block text-[10px] uppercase font-semibold">
                              Delivery Address:
                            </span>
                            <span className="block mt-0.5 text-[#fcfaf6]">{order.deliveryAddress}</span>
                          </div>

                          <div className="pt-1.5 border-t border-[#184227]">
                            <span className="text-[#8ea896] block text-[10px] uppercase font-semibold">
                              Special Instructions:
                            </span>
                            {order.specialInstructions && order.specialInstructions.trim() ? (
                              <div className="mt-1 text-[#dfb64c] bg-[#123620] p-2 rounded-lg border border-[#245937] font-medium text-xs whitespace-pre-wrap flex items-start gap-1.5">
                                <span className="shrink-0 text-sm">📝</span>
                                <span>{order.specialInstructions.trim()}</span>
                              </div>
                            ) : (
                              <span className="block mt-0.5 text-[#6d8a76] italic text-[11px]">
                                No special instructions
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Customer Location & Google Maps (Requirements 3, 4, 5) */}
                        <div className="py-2.5 px-3 my-2 bg-[#0a1e12] border border-[#1e4b2d] rounded-xl text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#dfb64c] flex items-center gap-1.5 text-xs">
                              <MapPin className="w-3.5 h-3.5 text-[#dfb64c]" />
                              <span>📍 Customer Location</span>
                            </span>
                            {order.customerLatitude && order.customerLongitude ? (
                              <span className="font-mono text-[10px] text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-600/40 font-semibold">
                                GPS Attached
                              </span>
                            ) : (
                              <span className="text-[10px] text-[#8ea896] italic">
                                Manual Address Only
                              </span>
                            )}
                          </div>

                          {order.customerLatitude && order.customerLongitude ? (
                            <div className="space-y-2">
                              <div className="text-[11px] text-[#a6bfae] font-mono flex flex-wrap items-center justify-between bg-[#113320] px-2.5 py-1.5 rounded border border-[#1b432a]">
                                <span>Lat: {order.customerLatitude.toFixed(6)}</span>
                                <span>Lng: {order.customerLongitude.toFixed(6)}</span>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                {/* Open in Google Maps (Requirement 3: When the admin clicks it, open the exact customer location in Google Maps) */}
                                <a
                                  href={order.googleMapsUrl || `https://www.google.com/maps?q=${order.customerLatitude},${order.customerLongitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 bg-[#164929] hover:bg-[#1e5f36] text-[#dfb64c] border border-[#dfb64c]/40 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer shadow-sm"
                                  id={`open-maps-${order.id}`}
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-[#dfb64c]" />
                                  <span>Open in Google Maps</span>
                                </a>

                                {/* Share via WhatsApp (Requirement 4: generate Google Maps location link so it can be shared through WhatsApp) */}
                                <button
                                  type="button"
                                  onClick={() => handleShareWhatsApp(order)}
                                  className="inline-flex items-center gap-1.5 bg-emerald-900/90 hover:bg-emerald-800 text-emerald-200 border border-emerald-500/40 font-semibold px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                                  title="Share order details and customer Google Maps location via WhatsApp"
                                >
                                  <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Share WhatsApp</span>
                                </button>

                                {/* Copy Maps Link */}
                                <button
                                  type="button"
                                  onClick={() => handleCopyMapsLink(order)}
                                  className="inline-flex items-center gap-1 text-[#8ea896] hover:text-[#fcfaf6] px-2 py-1 text-xs cursor-pointer"
                                  title="Copy Google Maps link to clipboard"
                                >
                                  <Copy className="w-3 h-3" />
                                  <span>{copiedOrderId === order.id ? 'Copied!' : 'Copy Link'}</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-[#799983]">
                              Customer placed order with manual address input without GPS coordinates.
                            </p>
                          )}
                        </div>

                        {/* Items List */}
                        <div className="py-3 space-y-1.5 text-xs">
                          {order.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex justify-between items-center text-[#fcfaf6] bg-[#091a10] px-2.5 py-1.5 rounded-lg"
                            >
                              <span className="font-medium">
                                <strong className="text-[#dfb64c] mr-1.5">{item.quantity}x</strong>
                                {item.itemName}
                              </span>
                              <span className="font-mono text-[#c9dcce]">₹{item.subtotal}</span>
                            </div>
                          ))}
                        </div>

                        {/* Amount & Prep Time */}
                        <div className="pt-2 border-t border-[#1b432a] flex items-center justify-between text-xs">
                          <div className="text-[11px] text-[#8ea896]">
                            <span>Food: ₹{order.foodTotal}</span> • <span>Delivery: ₹{order.deliveryCharge}</span>
                          </div>
                          <div className="font-mono font-bold text-base text-[#dfb64c]">
                            ₹{order.grandTotal} (COD)
                          </div>
                        </div>

                        {/* Preparation Time & Live Remaining Countdown */}
                        {(order.status === 'Accepted' || order.status === 'Preparing') && (
                          <div className="mt-2.5 p-2.5 bg-[#091f13] border border-[#245937] rounded-xl text-xs space-y-1.5">
                            <div className="flex items-center justify-between text-[#dfb64c]">
                              <span className="font-semibold flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-[#dfb64c]" />
                                <span>Prep Time: {order.preparationMinutes || order.estimatedPrepTimeMinutes || 15} mins</span>
                              </span>
                              {order.estimatedReadyAt && (
                                <span className="font-mono text-[11px] text-[#8ea896]">
                                  Ready: {new Date(order.estimatedReadyAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                </span>
                              )}
                            </div>

                            {(() => {
                              const readyMs = order.estimatedReadyAt
                                ? new Date(order.estimatedReadyAt).getTime()
                                : order.acceptedAt
                                ? new Date(order.acceptedAt).getTime() + (order.preparationMinutes || order.estimatedPrepTimeMinutes || 15) * 60000
                                : 0;
                              if (!readyMs) return null;
                              const diffSec = Math.floor((readyMs - adminClock) / 1000);
                              if (diffSec > 0) {
                                const m = Math.floor(diffSec / 60);
                                const s = diffSec % 60;
                                return (
                                  <div className="font-mono text-emerald-300 font-bold flex items-center gap-1.5 bg-[#123620] px-2 py-1 rounded border border-[#245937]">
                                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                    <span>Remaining Time: {m}m {s < 10 ? '0' : ''}{s}s ({Math.ceil(diffSec / 60)} mins left)</span>
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="font-bold text-amber-300 flex items-center gap-1.5 bg-amber-950/80 px-2 py-1 rounded border border-amber-600/40">
                                    <span>⚠️ Food should be ready now</span>
                                  </div>
                                );
                              }
                            })()}
                          </div>
                        )}

                        {order.status === 'Ready' && (
                          <div className="mt-2.5 p-2 bg-emerald-950/80 border border-emerald-600/60 rounded-xl text-xs text-emerald-300 font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>Food Ready & Packed (Awaiting Rider / Pickup)</span>
                          </div>
                        )}
                      </div>

                      {/* Action Controllers */}
                      <div className="mt-4 pt-3 border-t border-[#1b432a] space-y-2">
                        {isNew ? (
                          /* ACCEPT / REJECT DIRECT ACTIONS (Requirement 13) */
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAcceptOrderClick(order)}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>ACCEPT ORDER</span>
                            </button>
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'Order Rejected')}
                              className="bg-red-950 hover:bg-red-900 text-red-200 border border-red-700 py-2.5 px-4 rounded-xl text-xs font-semibold cursor-pointer"
                            >
                              REJECT
                            </button>
                            <button
                              onClick={() => triggerThermalPrint(order, 'KOT')}
                              className="bg-[#123620] hover:bg-[#1a472c] text-[#dfb64c] border border-[#245937] px-2.5 py-2 rounded-xl cursor-pointer flex items-center gap-1 text-xs font-semibold"
                              title="Print Kitchen Order Ticket (KOT)"
                            >
                              <Printer className="w-4 h-4" />
                              <span className="hidden sm:inline">KOT</span>
                            </button>
                            <button
                              onClick={() => triggerThermalPrint(order, 'BILL')}
                              className="bg-[#123620] hover:bg-[#1a472c] text-emerald-300 border border-[#245937] px-2.5 py-2 rounded-xl cursor-pointer flex items-center gap-1 text-xs font-semibold"
                              title="Print Customer Bill / Invoice"
                            >
                              <FileText className="w-4 h-4" />
                              <span className="hidden sm:inline">Bill</span>
                            </button>
                          </div>
                        ) : (
                          /* STEP BY STEP STATUS CONTROLLER (Requirement 15) */
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
                              {order.status === 'Accepted' && (
                                <button
                                  onClick={() => handleUpdateOrderStatus(order.id, 'Preparing')}
                                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2 px-3 rounded-xl cursor-pointer shrink-0"
                                >
                                  Mark Preparing
                                </button>
                              )}
                              {order.status === 'Preparing' && (
                                <button
                                  onClick={() => handleUpdateOrderStatus(order.id, 'Ready')}
                                  className="bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs py-2 px-3 rounded-xl cursor-pointer shrink-0"
                                >
                                  Mark Ready & Packed
                                </button>
                              )}
                              {order.status === 'Ready' && (
                                <button
                                  onClick={() => handleUpdateOrderStatus(order.id, 'Out for Delivery')}
                                  className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs py-2 px-3 rounded-xl cursor-pointer shrink-0"
                                >
                                  Dispatch (Out for Delivery)
                                </button>
                              )}
                              {order.status === 'Out for Delivery' && (
                                <button
                                  onClick={() => handleUpdateOrderStatus(order.id, 'Delivered')}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 px-3 rounded-xl cursor-pointer shrink-0"
                                >
                                  Mark Delivered
                                </button>
                              )}

                              {/* Change / Set Prep Time */}
                              {(order.status === 'Accepted' || order.status === 'Preparing') && (
                                <button
                                  onClick={() => handleAcceptOrderClick(order)}
                                  className="bg-[#153e26] hover:bg-[#1d5233] text-[#dfb64c] border border-[#2e6843] font-semibold text-xs py-2 px-2.5 rounded-xl cursor-pointer shrink-0 flex items-center gap-1"
                                  title="Change food preparation time"
                                >
                                  <Clock className="w-3.5 h-3.5 text-[#dfb64c]" />
                                  <span>Change Prep Time</span>
                                </button>
                              )}
                            </div>

                            {/* Print Buttons: KOT & Bill */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => triggerThermalPrint(order, 'KOT')}
                                className="bg-[#123620] hover:bg-[#1a472c] text-[#dfb64c] border border-[#245937] text-xs font-semibold py-2 px-2.5 rounded-xl flex items-center gap-1 cursor-pointer"
                                title="Print Kitchen Order Ticket (KOT)"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>KOT</span>
                              </button>
                              <button
                                onClick={() => triggerThermalPrint(order, 'BILL')}
                                className="bg-[#123620] hover:bg-[#1a472c] text-emerald-300 border border-[#245937] text-xs font-semibold py-2 px-2.5 rounded-xl flex items-center gap-1 cursor-pointer"
                                title="Print Customer Bill / Invoice"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Bill</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: MENU MANAGEMENT WITH AUTOMATIC WATERMARKING                       */}
        {/* ========================================================================= */}
        {activeTab === 'menu' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1b432a]">
              <div>
                <h2 className="text-xl font-brand font-bold text-[#fcfaf6]">
                  Hotel Malabar Menu Catalog
                </h2>
                <p className="text-xs text-[#8ea896]">
                  Every food photo automatically embeds the mandatory watermark:
                  <code className="text-[#dfb64c] bg-[#091a10] px-2 py-0.5 rounded font-mono ml-1">
                    {EXACT_WATERMARK_TEXT}
                  </code>
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingItem(null);
                  setItemForm({
                    name: '',
                    categoryId: categories[0]?.id || '',
                    price: '',
                    description: '',
                    imageUrl:
                      'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80',
                    isVeg: false,
                    isAvailable: true,
                    prepTimeMinutes: '10',
                  });
                  setItemModalOpen(true);
                }}
                className="bg-gradient-to-r from-[#dfb64c] to-[#cba135] text-[#0a1f13] font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow flex items-center gap-2 cursor-pointer hover:from-[#ebd06b]"
              >
                <Plus className="w-4 h-4" />
                <span>Add Food Item</span>
              </button>
            </div>

            {/* Filter by Category & Search */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 max-w-xs relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#799983]" />
                <input
                  type="text"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  placeholder="Filter menu items..."
                  className="w-full bg-[#123620] border border-[#245937] rounded-xl pl-9 pr-3 py-2 text-xs text-[#fcfaf6] placeholder-[#6d8a76] focus:outline-none focus:border-[#dfb64c]"
                />
              </div>

              <select
                value={selectedMenuCategory}
                onChange={(e) => setSelectedMenuCategory(e.target.value)}
                className="bg-[#123620] border border-[#245937] rounded-xl px-3 py-2 text-xs text-[#fcfaf6] focus:outline-none focus:border-[#dfb64c]"
              >
                <option value="all">All 22 Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Menu Items Table / Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {menuItems
                .filter((item) => {
                  if (selectedMenuCategory !== 'all' && item.categoryId !== selectedMenuCategory) {
                    return false;
                  }
                  if (
                    menuSearch &&
                    !item.name.toLowerCase().includes(menuSearch.toLowerCase()) &&
                    !item.description.toLowerCase().includes(menuSearch.toLowerCase())
                  ) {
                    return false;
                  }
                  return true;
                })
                .map((item) => {
                  const cat = categories.find((c) => c.id === item.categoryId);

                  return (
                    <div
                      key={item.id}
                      className="bg-[#0f2d1c] border border-[#214f34] rounded-2xl overflow-hidden shadow flex flex-col justify-between"
                    >
                      <div className="relative aspect-[16/9] w-full bg-[#081a10]">
                        <WatermarkedImage
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full"
                          watermarkSize="sm"
                        />
                        <div className="absolute top-2 left-2 bg-[#0a1f13]/85 px-2 py-0.5 rounded text-[10px] text-[#dfb64c] border border-[#214f34]">
                          {cat?.name}
                        </div>

                        {/* Quick photo replacement button */}
                        <label
                          className="absolute top-2 right-2 bg-[#0a1f13]/90 hover:bg-[#143d26] text-[#dfb64c] p-1.5 rounded-lg cursor-pointer border border-[#cba135]/50 transition-colors shadow"
                          title="Quick Replace Photo (Auto-Watermarked)"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleQuickPhotoReplace(item, f);
                            }}
                          />
                        </label>

                        {quickPhotoLoadingId === item.id && (
                          <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-xs text-[#dfb64c] gap-1 z-10">
                            <RefreshCw className="w-5 h-5 animate-spin" />
                            <span className="font-semibold text-[11px]">Baking Watermark...</span>
                          </div>
                        )}
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="font-semibold text-sm sm:text-base text-[#fcfaf6]">
                              {item.name}
                            </h4>
                            <span className="font-mono font-bold text-sm text-[#dfb64c]">
                              ₹{item.price}
                            </span>
                          </div>
                          <p className="text-xs text-[#8ea896] line-clamp-2">{item.description}</p>
                          <div className="flex items-center gap-2 mt-2 text-[10px] text-[#8ea896]">
                            <span className="bg-[#123620] px-2 py-0.5 rounded border border-[#214f34] text-[#a6bfae]">
                              ⏱ {item.prepTimeMinutes || 10} mins prep
                            </span>
                            <span className={`px-2 py-0.5 rounded border ${item.isVeg ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-amber-950 text-amber-300 border-amber-800'}`}>
                              {item.isVeg ? 'Veg' : 'Non-Veg'}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-[#1b432a] flex items-center justify-between gap-2">
                          <div className="inline-flex items-center rounded-xl bg-[#091a10] p-0.5 border border-[#214f34]">
                            <button
                              type="button"
                              onClick={() => !item.isAvailable && handleToggleItemAvailability(item)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                item.isAvailable
                                  ? 'bg-emerald-600 text-white shadow'
                                  : 'text-stone-400 hover:text-emerald-300'
                              }`}
                            >
                              AVAILABLE
                            </button>
                            <button
                              type="button"
                              onClick={() => item.isAvailable && handleToggleItemAvailability(item)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                !item.isAvailable
                                  ? 'bg-red-600 text-white shadow'
                                  : 'text-stone-400 hover:text-red-300'
                              }`}
                            >
                              OUT OF STOCK
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Reorder Buttons */}
                            <button
                              onClick={() => handleMoveMenuItem(item.id, 'up')}
                              className="p-1.5 bg-[#143d26] text-[#dfb64c] hover:bg-[#1d5435] border border-[#214f34] rounded-lg cursor-pointer"
                              title="Move item up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleMoveMenuItem(item.id, 'down')}
                              className="p-1.5 bg-[#143d26] text-[#dfb64c] hover:bg-[#1d5435] border border-[#214f34] rounded-lg cursor-pointer"
                              title="Move item down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                setEditingItem(item);
                                setItemForm({
                                  name: item.name,
                                  categoryId: item.categoryId,
                                  price: item.price.toString(),
                                  description: item.description,
                                  imageUrl: item.imageUrl,
                                  isVeg: item.isVeg,
                                  isAvailable: item.isAvailable,
                                  prepTimeMinutes: (item.prepTimeMinutes || 10).toString(),
                                });
                                setItemModalOpen(true);
                              }}
                              className="p-1.5 bg-[#143d26] text-[#dfb64c] hover:bg-[#1d5435] border border-[#214f34] rounded-lg cursor-pointer"
                              title="Edit item"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteMenuItem(item.id)}
                              className="p-1.5 bg-red-950/80 text-red-400 hover:bg-red-900 border border-red-900/60 rounded-lg cursor-pointer"
                              title="Delete item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2B: MENU CATEGORIES MANAGEMENT                                        */}
        {/* ========================================================================= */}
        {activeTab === 'categories' && (
          <AdminCategoryManager
            adminToken={adminToken!}
            categories={categories}
            menuItems={menuItems}
            onCategoriesChanged={fetchAllAdminData}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB 2C: RESTAURANT PROFILE & BRANDING                                     */}
        {/* ========================================================================= */}
        {activeTab === 'profile' && (
          <AdminProfileManager
            adminToken={adminToken!}
            onProfileUpdated={() => fetchAllAdminData()}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB 3: DELIVERY SETTINGS & LOCATIONS                                      */}
        {/* ========================================================================= */}
        {activeTab === 'delivery' && (
          <div className="space-y-6 max-w-4xl">
            <div className="pb-3 border-b border-[#1b432a]">
              <h2 className="text-xl font-brand font-bold text-[#fcfaf6]">
                Delivery Pricing & Location Boundaries
              </h2>
              <p className="text-xs text-[#8ea896]">
                Configure restaurant delivery fees, free distance allowance, and coverage areas.
              </p>
            </div>

            {/* Core Delivery Rules Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#0f2d1c] border border-[#235836] rounded-2xl p-4">
                <label className="block text-xs font-semibold text-[#dfb64c] mb-1">
                  Free Delivery Allowance
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={deliverySettings.freeDeliveryKm}
                    onChange={(e) =>
                      setDeliverySettings({
                        ...deliverySettings,
                        freeDeliveryKm: Number(e.target.value),
                      })
                    }
                    className="w-full bg-[#123620] border border-[#245937] rounded-xl p-2.5 text-sm text-[#fcfaf6] font-mono font-bold"
                  />
                  <span className="text-xs text-[#c9dcce]">km</span>
                </div>
                <p className="text-[10px] text-[#8ea896] mt-1">
                  Customers within this distance pay ₹0 delivery fee.
                </p>
              </div>

              <div className="bg-[#0f2d1c] border border-[#235836] rounded-2xl p-4">
                <label className="block text-xs font-semibold text-[#dfb64c] mb-1">
                  Additional Charge Per Km
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#c9dcce]">₹</span>
                  <input
                    type="number"
                    value={deliverySettings.perKmCharge}
                    onChange={(e) =>
                      setDeliverySettings({
                        ...deliverySettings,
                        perKmCharge: Number(e.target.value),
                      })
                    }
                    className="w-full bg-[#123620] border border-[#245937] rounded-xl p-2.5 text-sm text-[#fcfaf6] font-mono font-bold"
                  />
                </div>
                <p className="text-[10px] text-[#8ea896] mt-1">
                  Charged for every started km beyond free distance.
                </p>
              </div>

              <div className="bg-[#0f2d1c] border border-[#235836] rounded-2xl p-4">
                <label className="block text-xs font-semibold text-[#dfb64c] mb-1">
                  Minimum Food Order
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#c9dcce]">₹</span>
                  <input
                    type="number"
                    value={deliverySettings.minOrderAmount}
                    onChange={(e) =>
                      setDeliverySettings({
                        ...deliverySettings,
                        minOrderAmount: Number(e.target.value),
                      })
                    }
                    className="w-full bg-[#123620] border border-[#245937] rounded-xl p-2.5 text-sm text-[#fcfaf6] font-mono font-bold"
                  />
                </div>
                <p className="text-[10px] text-[#8ea896] mt-1">
                  Orders below this amount cannot be placed.
                </p>
              </div>
            </div>

            {/* Kitchen Preparation Time Settings (Item 17) & Restaurant Status (Item 21) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Default Kitchen Preparation Time */}
              <div className="bg-[#0f2d1c] border border-[#235836] rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2.5 text-[#dfb64c]">
                  <Clock className="w-5 h-5" />
                  <h3 className="text-sm font-bold text-[#fcfaf6]">Kitchen Preparation Time (Item 17)</h3>
                </div>
                <p className="text-xs text-[#8ea896]">
                  Default preparation duration displayed to customers and pre-selected when accepting orders.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {[10, 15, 20, 30, 45].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() =>
                        setDeliverySettings({
                          ...deliverySettings,
                          defaultPrepTimeMinutes: mins,
                        })
                      }
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        deliverySettings.defaultPrepTimeMinutes === mins
                          ? 'bg-[#dfb64c] text-[#0a1f13] border-[#dfb64c]'
                          : 'bg-[#123620] text-[#c9dcce] border-[#245937] hover:border-[#dfb64c]'
                      }`}
                    >
                      {mins} mins
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-[#8ea896]">Custom time:</span>
                  <input
                    type="number"
                    min="5"
                    max="120"
                    value={deliverySettings.defaultPrepTimeMinutes || 10}
                    onChange={(e) =>
                      setDeliverySettings({
                        ...deliverySettings,
                        defaultPrepTimeMinutes: Number(e.target.value) || 10,
                      })
                    }
                    className="w-24 bg-[#123620] border border-[#245937] rounded-xl px-3 py-1.5 text-xs text-[#fcfaf6] font-mono font-bold"
                  />
                  <span className="text-xs text-[#c9dcce]">minutes</span>
                </div>
              </div>

              {/* Restaurant Open / Closed Switch & Operating Hours */}
              <div className="bg-[#0f2d1c] border border-[#235836] rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[#dfb64c]">
                    <Utensils className="w-5 h-5" />
                    <h3 className="text-sm font-bold text-[#fcfaf6]">Operating Hours & Kitchen Status</h3>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      deliverySettings.isRestaurantOpen
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                        : 'bg-red-950 text-red-300 border-red-600'
                    }`}
                  >
                    {deliverySettings.isRestaurantOpen ? '● CURRENTLY OPEN' : '○ CURRENTLY CLOSED'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-[#0a1f13] p-3 rounded-xl border border-[#1b432a]">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#dfb64c] mb-1">
                      Daily Opening Time (IST)
                    </label>
                    <input
                      type="time"
                      value={deliverySettings.openingTime || '07:00'}
                      onChange={(e) =>
                        setDeliverySettings({
                          ...deliverySettings,
                          openingTime: e.target.value,
                        })
                      }
                      className="w-full bg-[#123620] border border-[#245937] rounded-lg p-2 text-xs text-[#fcfaf6] font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#dfb64c] mb-1">
                      Daily Closing Time (IST)
                    </label>
                    <input
                      type="time"
                      value={deliverySettings.closingTime || '22:00'}
                      onChange={(e) =>
                        setDeliverySettings({
                          ...deliverySettings,
                          closingTime: e.target.value,
                        })
                      }
                      className="w-full bg-[#123620] border border-[#245937] rounded-lg p-2 text-xs text-[#fcfaf6] font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#8ea896] mb-2">
                    Service Control Mode (Overrides):
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSetRestaurantManualStatus('auto')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                        deliverySettings.manualStatus === 'auto'
                          ? 'bg-[#dfb64c] text-[#0a1f13] border-[#dfb64c] shadow'
                          : 'bg-[#123620] text-[#c9dcce] border-[#245937] hover:border-[#dfb64c]'
                      }`}
                    >
                      AUTO SCHEDULE
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetRestaurantManualStatus('open')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                        deliverySettings.manualStatus === 'open'
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                          : 'bg-[#123620] text-emerald-400 border-[#245937] hover:border-emerald-500'
                      }`}
                    >
                      OPEN RESTAURANT
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetRestaurantManualStatus('closed')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                        deliverySettings.manualStatus === 'closed'
                          ? 'bg-red-600 text-white border-red-500 shadow'
                          : 'bg-[#123620] text-red-400 border-[#245937] hover:border-red-500'
                      }`}
                    >
                      CLOSE RESTAURANT
                    </button>
                  </div>
                  <p className="text-[11px] text-[#8ea896] mt-2">
                    {deliverySettings.manualStatus === 'auto' &&
                      '• Operating automatically according to opening & closing times (07:00 to 22:00 IST).'}
                    {deliverySettings.manualStatus === 'open' &&
                      '• Forced OPEN by Admin. Customers can order regardless of schedule.'}
                    {deliverySettings.manualStatus === 'closed' &&
                      '• Forced CLOSED by Admin. Customers see "Restaurant Closed" and cannot checkout.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Delivery Areas Table */}
            <div className="bg-[#0f2d1c] border border-[#235836] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-[#fcfaf6]">
                    Configured Delivery Areas
                  </h3>
                  <p className="text-xs text-[#8ea896]">
                    Distance from Hotel Malabar (Bommasandra main road)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newAreaName = prompt('Enter Area Name (e.g. Hebbagodi):');
                    if (!newAreaName) return;
                    const distance = parseFloat(prompt('Enter distance in km (e.g. 3.0):') || '2.5');
                    setDeliveryAreas((prev) => [
                      ...prev,
                      {
                        id: `area-${Date.now()}`,
                        name: newAreaName.trim(),
                        distanceKm: distance || 2.5,
                        isActive: true,
                      },
                    ]);
                  }}
                  className="bg-[#143d26] hover:bg-[#1a4e31] text-[#dfb64c] border border-[#cba135]/50 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Area</span>
                </button>
              </div>

              <div className="space-y-2">
                {deliveryAreas.map((area, idx) => (
                  <div
                    key={area.id}
                    className="flex items-center justify-between bg-[#113320] p-3 rounded-xl border border-[#1b432a] text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#fcfaf6]">{area.name}</span>
                      <span className="text-[10px] bg-[#091a10] border border-[#1b432a] text-[#dfb64c] px-2 py-0.5 rounded font-mono">
                        {area.distanceKm} km
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const newDist = prompt(`Enter new distance in km for ${area.name}:`, area.distanceKm.toString());
                          if (!newDist) return;
                          const updated = [...deliveryAreas];
                          updated[idx].distanceKm = parseFloat(newDist) || area.distanceKm;
                          setDeliveryAreas(updated);
                        }}
                        className="text-[#a6bfae] hover:text-[#dfb64c] cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${area.name}?`)) {
                            setDeliveryAreas(deliveryAreas.filter((a) => a.id !== area.id));
                          }
                        }}
                        className="text-red-400 hover:text-red-300 cursor-pointer ml-2"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveDeliverySettings}
              className="bg-gradient-to-r from-[#dfb64c] to-[#cba135] text-[#0a1f13] font-bold text-sm py-3 px-6 rounded-xl shadow hover:from-[#ebd06b] cursor-pointer"
            >
              Save All Delivery Settings
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: REGISTERED CUSTOMERS DATABASE (Requirement 19)                    */}
        {/* ========================================================================= */}
        {activeTab === 'customers' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1b432a]">
              <div>
                <h2 className="text-xl font-brand font-bold text-[#fcfaf6]">
                  Registered Customers Directory
                </h2>
                <p className="text-xs text-[#8ea896]">
                  View customer profiles, contact numbers, order histories, and total spend.
                </p>
              </div>

              <div className="w-full sm:w-64 relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#799983]" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search by name or phone..."
                  className="w-full bg-[#123620] border border-[#245937] rounded-xl pl-9 pr-3 py-2 text-xs text-[#fcfaf6] placeholder-[#6d8a76] focus:outline-none focus:border-[#dfb64c]"
                />
              </div>
            </div>

            <div className="bg-[#0f2d1c] border border-[#235836] rounded-2xl overflow-hidden shadow">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#c9dcce]">
                  <thead className="bg-[#091a10] border-b border-[#1b432a] text-[#8ea896] uppercase text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Customer Name</th>
                      <th className="px-4 py-3">Phone Number</th>
                      <th className="px-4 py-3">Delivery Area</th>
                      <th className="px-4 py-3">Registered On</th>
                      <th className="px-4 py-3">Total Orders</th>
                      <th className="px-4 py-3">Total Spent</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1b432a]">
                    {customers
                      .filter((c) => {
                        if (!customerSearch) return true;
                        const q = customerSearch.toLowerCase();
                        return (
                          c.firstName?.toLowerCase().includes(q) ||
                          c.lastName?.toLowerCase().includes(q) ||
                          c.phone?.includes(q)
                        );
                      })
                      .map((cust) => (
                        <tr key={cust.id} className="hover:bg-[#133822]/50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-[#fcfaf6]">
                            {cust.firstName} {cust.lastName}
                          </td>
                          <td className="px-4 py-3 font-mono text-[#dfb64c]">{cust.phone}</td>
                          <td className="px-4 py-3">{cust.profile?.deliveryArea || '—'}</td>
                          <td className="px-4 py-3 text-[#8ea896]">
                            {new Date(cust.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-center sm:text-left">
                            {cust.totalOrders}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-[#dfb64c]">
                            ₹{cust.totalSpent}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setCustomerOrdersModal(cust)}
                              className="bg-[#143d26] hover:bg-[#1a4e31] text-[#dfb64c] border border-[#cba135]/40 px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              View Orders ({cust.totalOrders})
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: PREPARATION TIME PICKER (Requirement 3)                            */}
      {/* ========================================================================= */}
      {prepTimeModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0e2a1b] border-2 border-[#dfb64c] rounded-2xl p-6 text-[#fdfbf7] shadow-2xl space-y-4">
            <div className="text-center pb-2 border-b border-[#1b432a]">
              <span className="text-xs font-mono text-[#dfb64c]">
                {prepTimeModalOrder.status === 'Order Placed' ? 'ACCEPT ORDER' : 'CHANGE PREPARATION TIME'}{' '}
                #{prepTimeModalOrder.orderNumber}
              </span>
              <h3 className="font-brand text-xl font-bold mt-1">Food Preparation Time</h3>
              <p className="text-xs text-[#8ea896] mt-1">
                Customer tracking screen will immediately display live countdown timer and estimated ready time.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#dfb64c] mb-2 uppercase tracking-wide">
                Quick Options
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {[5, 10, 15, 20, 30].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => {
                      setSelectedPrepMinutes(mins);
                      setCustomPrepMinutes('');
                    }}
                    className={`py-3 px-1 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                      selectedPrepMinutes === mins && !customPrepMinutes
                        ? 'bg-[#dfb64c] text-[#0a1f13] border-[#dfb64c] shadow-lg scale-105'
                        : 'bg-[#123620] text-[#fcfaf6] border-[#245937] hover:bg-[#184428]'
                    }`}
                  >
                    {mins} MINS
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-xs font-semibold text-[#c9dcce] mb-1">
                CUSTOM TIME (Enter any minutes)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="180"
                  placeholder="e.g. 25 or 45"
                  value={customPrepMinutes}
                  onChange={(e) => {
                    setCustomPrepMinutes(e.target.value);
                    if (e.target.value) {
                      setSelectedPrepMinutes(parseInt(e.target.value, 10) || 15);
                    }
                  }}
                  className="w-full bg-[#123620] border border-[#245937] rounded-xl px-3.5 py-2.5 text-sm text-[#fcfaf6] font-mono focus:outline-none focus:border-[#dfb64c]"
                />
                <span className="absolute right-3.5 top-2.5 text-xs text-[#8ea896] pointer-events-none">
                  minutes
                </span>
              </div>
            </div>

            <div className="p-3 bg-[#0a1e12] border border-[#1b432a] rounded-xl text-xs space-y-1">
              <div className="flex justify-between text-[#8ea896]">
                <span>Selected Prep Time:</span>
                <span className="font-bold text-[#dfb64c] font-mono">
                  {customPrepMinutes ? `${customPrepMinutes} minutes (Custom)` : `${selectedPrepMinutes} minutes`}
                </span>
              </div>
              <div className="flex justify-between text-[#8ea896]">
                <span>Estimated Ready At:</span>
                <span className="font-bold text-emerald-300 font-mono">
                  {new Date(
                    Date.now() + (parseInt(customPrepMinutes, 10) || selectedPrepMinutes) * 60000
                  ).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPrepTimeModalOrder(null)}
                className="flex-1 bg-[#123620] hover:bg-[#184428] text-[#c9dcce] py-3 rounded-xl text-xs font-semibold cursor-pointer border border-[#245937]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAccept}
                className="flex-1 bg-gradient-to-r from-[#dfb64c] to-[#cba135] text-[#0a1f13] font-bold py-3 rounded-xl text-xs shadow-lg hover:from-[#e8c560] cursor-pointer"
              >
                {prepTimeModalOrder.status === 'Order Placed'
                  ? 'Accept & Start Timer'
                  : 'Save Prep Time'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT MENU ITEM WITH AUTOMATED WATERMARKING                   */}
      {/* ========================================================================= */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg bg-[#0e2a1b] border-2 border-[#26623c] rounded-2xl p-6 text-[#fdfbf7] shadow-2xl my-8 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1b432a]">
              <h3 className="font-brand text-xl font-bold">
                {editingItem ? 'Edit Menu Item' : 'Add New Food Item'}
              </h3>
              <button
                onClick={() => setItemModalOpen(false)}
                className="text-[#8ea896] hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMenuItem} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#c9dcce] mb-1 font-semibold">Item Name</label>
                <input
                  type="text"
                  required
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  placeholder="e.g. Thalassery Mutton Dum Biryani"
                  className="w-full bg-[#123620] border border-[#245937] rounded-xl px-3 py-2 text-sm text-[#fcfaf6] focus:outline-none focus:border-[#dfb64c]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#c9dcce] mb-1 font-semibold">Category</label>
                  <select
                    value={itemForm.categoryId}
                    onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}
                    className="w-full bg-[#123620] border border-[#245937] rounded-xl px-3 py-2 text-sm text-[#fcfaf6] focus:outline-none focus:border-[#dfb64c]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#c9dcce] mb-1 font-semibold">Price in ₹</label>
                  <input
                    type="number"
                    required
                    value={itemForm.price}
                    onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                    placeholder="260"
                    className="w-full bg-[#123620] border border-[#245937] rounded-xl px-3 py-2 text-sm text-[#fcfaf6] font-mono font-bold focus:outline-none focus:border-[#dfb64c]"
                  />
                </div>

                <div>
                  <label className="block text-[#c9dcce] mb-1 font-semibold">Prep Time (Mins)</label>
                  <input
                    type="number"
                    required
                    value={itemForm.prepTimeMinutes}
                    onChange={(e) => setItemForm({ ...itemForm, prepTimeMinutes: e.target.value })}
                    placeholder="10"
                    className="w-full bg-[#123620] border border-[#245937] rounded-xl px-3 py-2 text-sm text-[#fcfaf6] font-mono font-bold focus:outline-none focus:border-[#dfb64c]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#c9dcce] mb-1 font-semibold">Description</label>
                <textarea
                  rows={2}
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  placeholder="Traditional authentic preparation with special Malabar spices..."
                  className="w-full bg-[#123620] border border-[#245937] rounded-xl p-2.5 text-xs text-[#fcfaf6] focus:outline-none focus:border-[#dfb64c]"
                />
              </div>

              {/* Automated Watermark Upload Section (Requirement 16) */}
              <div className="p-3 bg-[#0a1f13] border border-[#225535] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[#dfb64c] flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Food Photo (Automated Watermark)</span>
                  </label>
                  <span className="text-[10px] text-[#8ea896]">Instant Canvas Baking</span>
                </div>

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="w-full text-xs text-[#a6bfae] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#164027] file:text-[#dfb64c] hover:file:bg-[#1d5435] cursor-pointer"
                />

                {imageUploading && (
                  <div className="text-xs text-[#dfb64c] flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Baking watermark into image...</span>
                  </div>
                )}

                {itemForm.imageUrl && (
                  <div className="mt-2">
                    <span className="text-[10px] text-[#8ea896] block mb-1">
                      Live Watermarked Preview:
                    </span>
                    <div className="relative aspect-[16/9] w-full rounded-lg overflow-hidden border border-[#dfb64c]/40">
                      <WatermarkedImage
                        src={itemForm.imageUrl}
                        alt="Preview"
                        className="w-full h-full"
                        watermarkSize="sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2 p-2 bg-[#123620] rounded-xl border border-[#245937] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemForm.isVeg}
                    onChange={(e) => setItemForm({ ...itemForm, isVeg: e.target.checked })}
                    className="rounded text-[#dfb64c]"
                  />
                  <span>Vegetarian Item</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-[#123620] rounded-xl border border-[#245937] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemForm.isAvailable}
                    onChange={(e) => setItemForm({ ...itemForm, isAvailable: e.target.checked })}
                    className="rounded text-[#dfb64c]"
                  />
                  <span>Available in Stock</span>
                </label>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setItemModalOpen(false)}
                  className="flex-1 bg-[#123620] text-[#c9dcce] py-2.5 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-[#dfb64c] to-[#cba135] text-[#0a1f13] font-bold py-2.5 rounded-xl shadow cursor-pointer"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CUSTOMER ORDER HISTORY INSPECTOR                                   */}
      {/* ========================================================================= */}
      {customerOrdersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0e2a1b] border border-[#26623c] rounded-2xl p-6 text-[#fdfbf7] shadow-2xl max-h-[85vh] flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-[#1b432a]">
              <div>
                <h3 className="font-brand text-lg font-bold">
                  {customerOrdersModal.firstName} {customerOrdersModal.lastName}
                </h3>
                <span className="text-xs font-mono text-[#dfb64c]">
                  📞 {customerOrdersModal.phone}
                </span>
              </div>
              <button
                onClick={() => setCustomerOrdersModal(null)}
                className="text-[#8ea896] hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-4 flex-1 overflow-y-auto space-y-2.5">
              {customerOrdersModal.orders?.length === 0 ? (
                <p className="text-xs text-[#8ea896] text-center py-6">No previous orders found.</p>
              ) : (
                customerOrdersModal.orders?.map((ord: Order) => (
                  <div
                    key={ord.id}
                    className="p-3 bg-[#113320] rounded-xl border border-[#1b432a] text-xs space-y-1"
                  >
                    <div className="flex justify-between font-semibold">
                      <span className="font-mono text-[#dfb64c]">{ord.orderNumber}</span>
                      <span>₹{ord.grandTotal} (COD)</span>
                    </div>
                    <div className="text-[11px] text-[#c9dcce]">
                      {ord.items.map((i) => `${i.quantity}x ${i.itemName}`).join(', ')}
                    </div>
                    <div className="flex justify-between text-[10px] text-[#8ea896] pt-1">
                      <span>{ord.deliveryArea}</span>
                      <span className="font-semibold text-emerald-300">{ord.status}</span>
                    </div>
                    {ord.customerLatitude && ord.customerLongitude && (
                      <div className="flex justify-between items-center text-[10px] text-emerald-400 pt-0.5">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span>GPS: {ord.customerLatitude.toFixed(4)}, {ord.customerLongitude.toFixed(4)}</span>
                        </span>
                        <a
                          href={ord.googleMapsUrl || `https://www.google.com/maps?q=${ord.customerLatitude},${ord.customerLongitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#dfb64c] hover:underline flex items-center gap-0.5"
                        >
                          <span>Maps</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-[#1b432a]">
              <button
                onClick={() => setCustomerOrdersModal(null)}
                className="w-full bg-[#123620] text-[#c9dcce] py-2 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: THERMAL RECEIPT & KOT PRINT PREVIEW                                 */}
      {/* ========================================================================= */}
      {selectedOrderForKOT && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm no-print">
          <div className="w-full max-w-md bg-[#0e2a1b] border border-[#26623c] rounded-2xl p-5 text-[#fdfbf7] shadow-2xl max-h-[90vh] flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-[#1b432a]">
              <div>
                <h3 className="font-brand text-base font-bold flex items-center gap-2">
                  <Printer className="w-4 h-4 text-[#dfb64c]" />
                  <span>Thermal Receipt & KOT Print</span>
                </h3>
                <span className="text-xs font-mono text-[#dfb64c]">
                  Order #{selectedOrderForKOT.orderNumber}
                </span>
              </div>
              <button
                onClick={() => setSelectedOrderForKOT(null)}
                className="text-[#8ea896] hover:text-white cursor-pointer text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Print Type & Width Selectors */}
            <div className="py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center bg-[#091a10] p-1 rounded-xl border border-[#1b432a]">
                <button
                  type="button"
                  onClick={() => setPrintType('KOT')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    printType === 'KOT'
                      ? 'bg-[#dfb64c] text-[#0a1f13]'
                      : 'text-[#8ea896] hover:text-white'
                  }`}
                >
                  KOT
                </button>
                <button
                  type="button"
                  onClick={() => setPrintType('BILL')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    printType === 'BILL'
                      ? 'bg-emerald-600 text-white'
                      : 'text-[#8ea896] hover:text-white'
                  }`}
                >
                  BILL / RECEIPT
                </button>
              </div>

              <div className="flex items-center bg-[#091a10] p-1 rounded-xl border border-[#1b432a]">
                <button
                  type="button"
                  onClick={() => setPrintPaperWidth('58mm')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    printPaperWidth === '58mm'
                      ? 'bg-[#1e4a30] text-[#dfb64c] border border-[#2d734a]'
                      : 'text-[#8ea896] hover:text-white'
                  }`}
                >
                  58mm Roll
                </button>
                <button
                  type="button"
                  onClick={() => setPrintPaperWidth('80mm')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    printPaperWidth === '80mm'
                      ? 'bg-[#1e4a30] text-[#dfb64c] border border-[#2d734a]'
                      : 'text-[#8ea896] hover:text-white'
                  }`}
                >
                  80mm Roll
                </button>
              </div>
            </div>

            {/* Paper Preview Box */}
            <div className="flex-1 overflow-y-auto bg-white text-black p-4 rounded-xl border border-stone-300 font-mono shadow-inner text-left my-1">
              <div
                style={{
                  width: printPaperWidth === '80mm' ? '100%' : '260px',
                  margin: '0 auto',
                  fontSize: printPaperWidth === '80mm' ? '12px' : '10.5px',
                  lineHeight: '1.25',
                }}
              >
                <div className="text-center font-bold pb-2 border-b border-dashed border-black">
                  <div className="text-sm font-extrabold">HOTEL MALABAR</div>
                  <div className="text-[10px]">AUTHENTIC KERALA CUISINE</div>
                  <div className="text-[9px]">Sulthan Bathery, Wayanad</div>
                  <div className="text-[9px]">Ph: 9567562071 / 8904634717</div>
                  <div className="inline-block border border-black px-1.5 py-0.5 mt-1 text-[10px] font-bold">
                    *** {printType === 'KOT' ? 'KITCHEN ORDER TICKET (KOT)' : 'CUSTOMER BILL / INVOICE'} ***
                  </div>
                </div>

                <div className="py-2 border-b border-dashed border-black space-y-0.5 text-[11px]">
                  <div className="flex justify-between font-bold">
                    <span>ORDER NO:</span>
                    <span>{selectedOrderForKOT.orderNumber}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>DATE: {new Date(selectedOrderForKOT.createdAt).toLocaleDateString('en-IN')}</span>
                    <span>TIME: {new Date(selectedOrderForKOT.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>STATUS:</span>
                    <span className="font-bold">{selectedOrderForKOT.status.toUpperCase()}</span>
                  </div>
                  {selectedOrderForKOT.estimatedPrepTimeMinutes && (
                    <div className="flex justify-between text-[10px]">
                      <span>PREP TIME:</span>
                      <span className="font-bold">{selectedOrderForKOT.estimatedPrepTimeMinutes} MINS</span>
                    </div>
                  )}
                </div>

                <div className="py-2 border-b border-dashed border-black text-[10px] space-y-0.5">
                  <div><strong>CUST:</strong> {selectedOrderForKOT.customerName}</div>
                  <div><strong>PHONE:</strong> {selectedOrderForKOT.customerPhone}</div>
                  <div><strong>AREA:</strong> {selectedOrderForKOT.deliveryArea} ({selectedOrderForKOT.deliveryDistanceKm} km)</div>
                  <div><strong>ADDR:</strong> {selectedOrderForKOT.deliveryAddress}</div>
                  {selectedOrderForKOT.customerLatitude && selectedOrderForKOT.customerLongitude && (
                    <div className="text-[9px]">
                      <strong>GPS:</strong> {selectedOrderForKOT.customerLatitude.toFixed(4)}, {selectedOrderForKOT.customerLongitude.toFixed(4)}
                    </div>
                  )}
                  <div className="bg-stone-100 p-1.5 border border-black mt-1 text-[10px]">
                    <strong className="block text-[9px]">SPECIAL INSTRUCTIONS:</strong>
                    {selectedOrderForKOT.specialInstructions && selectedOrderForKOT.specialInstructions.trim() ? (
                      <span className="font-bold">{selectedOrderForKOT.specialInstructions.trim()}</span>
                    ) : (
                      <span className="italic text-stone-600">No special instructions</span>
                    )}
                  </div>
                </div>

                <div className="py-2 border-b-2 border-black space-y-1">
                  <div className="flex justify-between font-bold text-[10px] border-b border-dashed border-black pb-1">
                    <span>QTY ITEM</span>
                    <span>PRICE</span>
                  </div>
                  {selectedOrderForKOT.items.map((it) => (
                    <div key={it.id} className="flex justify-between text-[10.5px]">
                      <span><strong>{it.quantity}x</strong> {it.itemName}</span>
                      <span className="font-bold">Rs.{it.subtotal}</span>
                    </div>
                  ))}
                </div>

                <div className="py-2 border-b border-dashed border-black space-y-0.5 text-[10.5px]">
                  <div className="flex justify-between">
                    <span>FOOD TOTAL:</span>
                    <span>Rs.{selectedOrderForKOT.foodTotal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>DELIVERY CHARGE:</span>
                    <span>Rs.{selectedOrderForKOT.deliveryCharge}</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-xs pt-1 border-t border-black">
                    <span>GRAND TOTAL:</span>
                    <span>Rs.{selectedOrderForKOT.grandTotal}</span>
                  </div>
                </div>

                <div className="text-center font-bold text-[10px] pt-2">
                  <div>PAYMENT: CASH ON DELIVERY (COD)</div>
                  <div className="text-[9px] mt-0.5">
                    {printType === 'KOT'
                      ? '*** PREPARE FRESH & DELIVER QUICKLY ***'
                      : '*** THANK YOU FOR ORDERING WITH HOTEL MALABAR ***'}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-[#1b432a] flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedOrderForKOT(null)}
                className="flex-1 bg-[#123620] hover:bg-[#1a472c] text-[#c9dcce] py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => triggerThermalPrint(selectedOrderForKOT, printType)}
                className="flex-2 bg-gradient-to-r from-[#dfb64c] to-[#cba135] text-[#0a1f13] font-bold py-2.5 rounded-xl text-xs shadow flex items-center justify-center gap-1.5 cursor-pointer hover:from-[#ebd06b]"
              >
                <Printer className="w-4 h-4" />
                <span>Print {printType} Now ({printPaperWidth})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fallback DOM Thermal Print Target */}
      <div id="thermal-print-container" className="hidden" />
    </div>
  );
};
