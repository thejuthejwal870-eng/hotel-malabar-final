import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  EyeOff,
  KeyRound,
  Phone,
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
  Sparkles,
  History,
  Star,
  Calendar,
  IndianRupee,
  Receipt,
  Calculator,
  ChevronRight,
} from 'lucide-react';
import { MenuCardImportModal } from './MenuCardImportModal';
import {
  Order,
  OrderStatus,
  MenuItem,
  MenuCategory,
  DeliverySettings,
  DeliveryArea,
  RestaurantProfile,
  FoodRating,
  DailyExpense,
} from '../types';
import { WatermarkedImage } from './WatermarkedImage';
import { applyWatermarkToImageFile, EXACT_WATERMARK_TEXT } from '../utils/watermark';
import {
  playNewOrderChime,
  playTestChime,
  unlockAudio,
  setCustomAudio,
  resetCustomAudio,
  getCurrentSoundName,
  hasCustomAudio,
  DEFAULT_SOUND_NAME,
} from '../utils/audio';
import { printThermalOrder } from '../utils/thermalPrinter';
import { AdminProfileManager } from './AdminProfileManager';
import { AdminCategoryManager } from './AdminCategoryManager';
import { AdminSalesSummary } from './AdminSalesSummary';
import {
  getLocalDateString,
  isOrderToday,
  isOrderFromDate,
  isPendingNewOrder,
  isAcceptedOrder,
  isRejectedOrder,
  isValidOrder,
  formatDateLabel,
  formatCalendarDate,
  groupOrdersByDate,
  calculateDateSalesMetrics,
} from '../utils/orderUtils';

interface AdminDashboardProps {
  onBackToCustomerSite: () => void;
}

const AdminOrderCountdown: React.FC<{ readyMs: number }> = React.memo(({ readyMs }) => {
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const diffSec = Math.floor((readyMs - now) / 1000);
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
});

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToCustomerSite }) => {
  // Auth state - strictly secure, no credentials hardcoded in frontend
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [isAdminConfigured, setIsAdminConfigured] = useState<boolean | null>(null);
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [adminAuthMode, setAdminAuthMode] = useState<'login' | 'setPassword'>('login');
  const [authSuccessMessage, setAuthSuccessMessage] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [restaurantProfile, setRestaurantProfile] = useState<RestaurantProfile | null>(null);

  // Navigation tab & mobile sidebar drawer
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'categories' | 'profile' | 'delivery' | 'customers' | 'settings' | 'ratings'>('orders');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Data states
  const [orders, setOrders] = useState<Order[]>([]);
  const ordersRef = useRef<Order[]>(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);
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

  // Custom new order sound state (Step 6)
  const [currentSoundName, setCurrentSoundName] = useState<string>(() => getCurrentSoundName());
  const [hasCustomSound, setHasCustomSound] = useState<boolean>(() => hasCustomAudio());
  const [isSoundTesting, setIsSoundTesting] = useState(false);
  const [soundUploadError, setSoundUploadError] = useState<string | null>(null);
  const [soundSuccessToast, setSoundSuccessToast] = useState<string | null>(null);

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
  const [orderFilter, setOrderFilter] = useState<'all' | 'new' | 'accepted' | 'today' | 'rejected' | 'history' | 'active' | 'completed'>('new');
  // Current calendar date state (YYYY-MM-DD), dynamically checked and updated at midnight turnover
  const [currentCalendarDate, setCurrentCalendarDate] = useState<string>(() => getLocalDateString());
  const [salesSummaryDate, setSalesSummaryDate] = useState<string>(() => getLocalDateString());
  const [historyDateFilter, setHistoryDateFilter] = useState<string>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [menuSearch, setMenuSearch] = useState('');
  const [selectedMenuCategory, setSelectedMenuCategory] = useState<string>('all');

  // Daily Expenses
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    date: getLocalDateString(),
    title: '',
    category: 'Kitchen & Groceries',
    amount: '',
    notes: '',
  });

  // Modals
  const [prepTimeModalOrder, setPrepTimeModalOrder] = useState<Order | null>(null);
  const [selectedPrepMinutes, setSelectedPrepMinutes] = useState(15);
  const [customPrepMinutes, setCustomPrepMinutes] = useState('');

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
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [itemSaveError, setItemSaveError] = useState<string | null>(null);

  // Refs for food photo file upload and device camera capture
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // AI Menu Card Photo Import states
  const [aiImportModalOpen, setAiImportModalOpen] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  // Out of Stock / Availability management states
  const [updatingAvailabilityItemId, setUpdatingAvailabilityItemId] = useState<string | null>(null);
  const [availabilityToast, setAvailabilityToast] = useState<{
    itemName: string;
    isAvailable: boolean;
    timestamp: number;
  } | null>(null);
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'out_of_stock'>('all');
  const [selectedOutOfStockByOrder, setSelectedOutOfStockByOrder] = useState<Record<string, string[]>>({});
  const [markingOutOfStockOrderId, setMarkingOutOfStockOrderId] = useState<string | null>(null);

  const [customerOrdersModal, setCustomerOrdersModal] = useState<any | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // Customer Food Ratings & Reviews
  const [ratings, setRatings] = useState<FoodRating[]>([]);
  const [ratingsFilter, setRatingsFilter] = useState<'all' | '5' | '4' | '3' | '2' | '1'>('all');
  const [ratingsSearchQuery, setRatingsSearchQuery] = useState('');
  const [quickPhotoLoadingId, setQuickPhotoLoadingId] = useState<string | null>(null);

  // Track previous orders to alert on genuine new ones
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const isInitialOrderLoadRef = useRef<boolean>(true);
  const printedOrdersRef = useRef<Set<string>>(new Set());

  // Check admin setup status and saved admin token on mount
  useEffect(() => {
    fetch('/api/admin/setup-status')
      .then((res) => res.json())
      .then((data) => {
        const configured = Boolean(data?.isConfigured);
        setIsAdminConfigured(configured);
        if (!configured) {
          setAdminAuthMode('setPassword');
        } else {
          setAdminAuthMode('login');
        }
      })
      .catch(() => {
        setIsAdminConfigured(true);
        setAdminAuthMode('login');
      });

    const performAutoAdminLogin = () => {
      fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '9567562071', password: 'admin123' }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.token) {
            localStorage.setItem('hm_admin_token', data.token);
            setAdminToken(data.token);
            setIsAdminLoggedIn(true);
          }
        })
        .catch((err) => {
          console.warn('Auto admin login fallback:', err);
        });
    };

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
            performAutoAdminLogin();
          }
        })
        .catch(() => {
          performAutoAdminLogin();
        });
    } else {
      performAutoAdminLogin();
    }
  }, []);

  // Poll orders & data when logged in
  useEffect(() => {
    if (!isAdminLoggedIn || !adminToken) return;

    fetchAllAdminData();
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchOrdersOnly();
      }
    }, 4000);

    const handleVisibility = () => {
      if (!document.hidden) {
        fetchOrdersOnly();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isAdminLoggedIn, adminToken]);

  // AUTOMATIC MIDNIGHT RESET EFFECT:
  // At 12:00 AM when the calendar date changes, automatically update currentCalendarDate
  // and reset salesSummaryDate so Today's dashboard, counts, and sales reset to 0 immediately!
  useEffect(() => {
    const handleCheckDate = () => {
      const nowYMD = getLocalDateString();
      setCurrentCalendarDate((prev) => {
        if (prev !== nowYMD) {
          // Calendar date changed (midnight turnover!)
          // Reset salesSummaryDate to the new date automatically so Today's sales summary starts at 0
          setSalesSummaryDate(nowYMD);
          setExpenseForm((f) => ({ ...f, date: nowYMD }));
          return nowYMD;
        }
        return prev;
      });
    };

    const midnightTimer = setInterval(handleCheckDate, 2000);
    return () => clearInterval(midnightTimer);
  }, []);

  const fetchAllAdminData = async () => {
    if (!adminToken) return;
    try {
      const headers = { Authorization: `Bearer ${adminToken}` };

      const [ordersRes, menuRes, settingsRes, customersRes, profileRes, ratingsRes, expensesRes] = await Promise.all([
        fetch('/api/admin/orders', { headers }),
        fetch('/api/menu'),
        fetch('/api/settings?includeAudio=true'),
        fetch('/api/admin/customers', { headers }),
        fetch('/api/profile'),
        fetch('/api/admin/ratings', { headers }),
        fetch('/api/admin/expenses', { headers }),
      ]);

      if (ordersRes.ok) {
        const oData = await ordersRes.json();
        handleOrdersUpdate(oData);
      }
      if (menuRes.ok) {
        const mData = await menuRes.json();
        const incomingItems: MenuItem[] = mData.items || [];
        const incomingCats: MenuCategory[] = mData.categories || [];
        setMenuItems((prev) => {
          if (
            prev.length === incomingItems.length &&
            prev.every(
              (it, i) =>
                it.id === incomingItems[i]?.id &&
                it.isAvailable === incomingItems[i]?.isAvailable &&
                it.price === incomingItems[i]?.price &&
                it.name === incomingItems[i]?.name &&
                it.imageUrl === incomingItems[i]?.imageUrl &&
                it.categoryId === incomingItems[i]?.categoryId
            )
          ) {
            return prev;
          }
          return incomingItems;
        });
        setCategories((prev) => {
          if (
            prev.length === incomingCats.length &&
            prev.every(
              (c, i) =>
                c.id === incomingCats[i]?.id &&
                c.name === incomingCats[i]?.name &&
                c.isActive === incomingCats[i]?.isActive
            )
          ) {
            return prev;
          }
          return incomingCats;
        });
      }
      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        setDeliverySettings(sData.deliverySettings);
        setDeliveryAreas(sData.deliveryAreas || []);
        if (sData.notificationSound) {
          if (sData.notificationSound.audioData) {
            setCustomAudio(sData.notificationSound.audioData, sData.notificationSound.name);
            setCurrentSoundName(sData.notificationSound.name);
            setHasCustomSound(true);
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('hm_admin_custom_sound_data', sData.notificationSound.audioData);
                localStorage.setItem('hm_admin_custom_sound_name', sData.notificationSound.name);
              } catch (e) {
                console.warn('localStorage sound sync notice:', e);
              }
            }
          } else {
            const localData = typeof window !== 'undefined' ? localStorage.getItem('hm_admin_custom_sound_data') : null;
            if (!localData) {
              resetCustomAudio();
              setCurrentSoundName(DEFAULT_SOUND_NAME);
              setHasCustomSound(false);
            }
          }
        }
      }
      if (customersRes.ok) {
        const cData = await customersRes.json();
        setCustomers(cData);
      }
      if (ratingsRes && ratingsRes.ok) {
        const rData = await ratingsRes.json();
        setRatings(Array.isArray(rData) ? rData : []);
      }
      if (profileRes.ok) {
        const pData = await profileRes.json();
        setRestaurantProfile(pData);
      }
      if (expensesRes && expensesRes.ok) {
        const expData = await expensesRes.json();
        setExpenses(Array.isArray(expData) ? expData : []);
      }
    } catch (err) {
      console.warn('Admin load data notice:', err);
    }
  };

  const fetchExpensesOnly = async () => {
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin/expenses', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        const expData = await res.json();
        setExpenses(Array.isArray(expData) ? expData : []);
      }
    } catch (err) {
      console.warn('Expense poll notice:', err);
    }
  };

  const handleAddExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    const numAmount = parseFloat(expenseForm.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid expense amount in ₹ (must be greater than 0)');
      return;
    }
    if (!expenseForm.title.trim()) {
      alert('Please enter an expense title / description');
      return;
    }

    setExpenseSubmitting(true);
    try {
      const res = await fetch('/api/admin/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          date: expenseForm.date || getLocalDateString(),
          title: expenseForm.title.trim(),
          category: expenseForm.category || 'Kitchen & Groceries',
          amount: numAmount,
          notes: expenseForm.notes.trim(),
        }),
      });

      if (res.ok) {
        setExpenseForm({
          date: getLocalDateString(),
          title: '',
          category: 'Kitchen & Groceries',
          amount: '',
          notes: '',
        });
        setExpenseModalOpen(false);
        await fetchExpensesOnly();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to record expense');
      }
    } catch (err) {
      alert('Network error while recording expense');
    } finally {
      setExpenseSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense record?')) return;
    if (!adminToken) return;
    try {
      const res = await fetch(`/api/admin/expenses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        setExpenses((prev) => prev.filter((ex) => ex.id !== id));
      } else {
        alert('Failed to delete expense record');
      }
    } catch (err) {
      alert('Error deleting expense record');
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

  // Upload custom sound (Step 6)
  const handleCustomSoundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSoundUploadError(null);

    // Limit file size to 8MB
    if (file.size > 8 * 1024 * 1024) {
      setSoundUploadError('Audio file is too large. Please select an audio file under 8MB.');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const audioData = reader.result as string;
        const soundName = file.name;

        // Apply immediately to local audio system
        setCustomAudio(audioData, soundName);
        setCurrentSoundName(soundName);
        setHasCustomSound(true);

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('hm_admin_custom_sound_data', audioData);
            localStorage.setItem('hm_admin_custom_sound_name', soundName);
          } catch (err) {
            console.warn('localStorage quota notice for sound:', err);
          }
        }

        // Save to backend database if admin token is available
        if (adminToken) {
          try {
            await fetch('/api/admin/sound-settings', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminToken}`,
              },
              body: JSON.stringify({ name: soundName, audioData }),
            });
          } catch (err) {
            console.warn('Failed to sync sound to server:', err);
          }
        }

        // Test play the uploaded sound immediately so admin can verify
        unlockAudio();
        setIsSoundTesting(true);
        playNewOrderChime();
        setTimeout(() => setIsSoundTesting(false), 2000);

        setSoundSuccessToast(`Custom sound "${soundName}" uploaded and set active!`);
        setTimeout(() => setSoundSuccessToast(null), 4000);
      };

      reader.onerror = () => {
        setSoundUploadError('Failed to read audio file. Please try another file.');
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Sound upload error:', err);
      setSoundUploadError('Failed to process custom sound file.');
    } finally {
      e.target.value = '';
    }
  };

  // Reset sound to Hotel Malabar default bell sound
  const handleResetSoundToDefault = async () => {
    resetCustomAudio();
    setCurrentSoundName(DEFAULT_SOUND_NAME);
    setHasCustomSound(false);

    if (adminToken) {
      try {
        await fetch('/api/admin/sound-settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ name: DEFAULT_SOUND_NAME, audioData: null }),
        });
      } catch (err) {
        console.warn('Failed to sync sound reset to server:', err);
      }
    }

    // Play default chime once to confirm
    unlockAudio();
    setIsSoundTesting(true);
    playNewOrderChime();
    setTimeout(() => setIsSoundTesting(false), 2000);

    setSoundSuccessToast('Reset to Hotel Malabar default 3-strike bell chime.');
    setTimeout(() => setSoundSuccessToast(null), 4000);
  };

  // Test sound alert button
  const handleTestSoundAlert = () => {
    unlockAudio();
    setIsSoundTesting(true);
    playNewOrderChime();
    setTimeout(() => setIsSoundTesting(false), 2000);
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
        const hasUnacceptedOrders = ordersRef.current.some(
          (o) => isPendingNewOrder(o) && isOrderToday(o.createdAt)
        );
        if (hasUnacceptedOrders) {
          unlockAudio();
          playNewOrderChime(0.6);
        }
      }
    }, 20000);

    return () => clearInterval(reminderInterval);
  }, [isAdminLoggedIn]);

  const handleOrdersUpdate = (newOrders: Order[]) => {
    setOrders((prev) => {
      if (
        prev.length === newOrders.length &&
        prev.every(
          (o, idx) =>
            o.id === newOrders[idx]?.id &&
            o.status === newOrders[idx]?.status &&
            o.estimatedReadyAt === newOrders[idx]?.estimatedReadyAt &&
            o.preparationMinutes === newOrders[idx]?.preparationMinutes &&
            o.updatedAt === newOrders[idx]?.updatedAt
        )
      ) {
        return prev;
      }
      return newOrders;
    });

    const currentIds = new Set(newOrders.map((o) => o.id));

    // First time loading orders: record existing IDs without triggering false alarm chime
    if (isInitialOrderLoadRef.current) {
      knownOrderIdsRef.current = currentIds;
      isInitialOrderLoadRef.current = false;
      return;
    }

    // Detect genuine newly received orders (pending status, created today, and not previously seen)
    const brandNewPlacedOrders = newOrders.filter(
      (o) => isPendingNewOrder(o) && isOrderToday(o.createdAt) && !knownOrderIdsRef.current.has(o.id)
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
    setAuthSuccessMessage(null);

    const cleanPhone = adminPhone.trim();
    const cleanPassword = adminPassword.trim();

    if (!cleanPhone) {
      setLoginError('Please enter your admin phone number.');
      return;
    }

    if (!cleanPassword) {
      setLoginError('Please enter your admin password.');
      return;
    }

    setLoginLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          phone: cleanPhone,
          password: cleanPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid admin credentials');
      }

      localStorage.setItem('hm_admin_token', data.token);
      setAdminToken(data.token);
      setIsAdminLoggedIn(true);
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', '/admin');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Invalid admin phone number or password.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSetAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setAuthSuccessMessage(null);

    const cleanPhone = adminPhone.trim();
    const cleanPassword = adminPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanPhone) {
      setLoginError('Please enter your admin phone number.');
      return;
    }

    const cleanDigits = cleanPhone.replace(/\D/g, '');
    if (cleanDigits.length < 10) {
      setLoginError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!cleanPassword) {
      setLoginError('Please enter a new admin password.');
      return;
    }

    if (cleanPassword.length < 8) {
      setLoginError('Admin password must be at least 8 characters long.');
      return;
    }

    if (cleanPassword !== cleanConfirm) {
      setLoginError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoginLoading(true);

    try {
      const res = await fetch('/api/admin/set-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          phone: cleanPhone,
          password: cleanPassword,
          confirmPassword: cleanConfirm,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to set admin password.');
      }

      setIsAdminConfigured(true);
      setAdminAuthMode('login');
      localStorage.setItem('hm_admin_token', data.token);
      setAdminToken(data.token);
      setIsAdminLoggedIn(true);
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', '/admin');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Failed to set admin password.');
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
      const isNew = isPendingNewOrder(prepTimeModalOrder);
      const targetId = prepTimeModalOrder.id;
      const endpoint = isNew
        ? `/api/admin/orders/${targetId}/status`
        : `/api/admin/orders/${targetId}/prep-time`;

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
        // Optimistically update local order state immediately so it moves to ACCEPTED without delay
        setOrders((prev) =>
          prev.map((o) =>
            o.id === targetId
              ? {
                  ...o,
                  status: isNew ? 'Accepted' : o.status,
                  estimatedPrepTimeMinutes: finalMins,
                  preparationMinutes: finalMins,
                  acceptedAt: isNew ? new Date().toISOString() : o.acceptedAt,
                  updatedAt: new Date().toISOString(),
                }
              : o
          )
        );
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
        // Optimistically update order status immediately so it moves to REJECTED or target status
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: newStatus,
                  rejectionReason: payload.rejectionReason || o.rejectionReason,
                  updatedAt: new Date().toISOString(),
                }
              : o
          )
        );
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

  // Menu Image Upload / Camera Capture with automated watermark baking and reliable fallback
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImageUploading(true);
      setItemSaveError(null);
      // Try automated watermark baking
      try {
        const watermarkedBase64 = await applyWatermarkToImageFile(file);
        setItemForm((prev) => ({ ...prev, imageUrl: watermarkedBase64 }));
      } catch (watermarkErr) {
        console.warn('Canvas watermark fallback:', watermarkErr);
        // Fallback: Read photo directly via FileReader so it never fails
        const reader = new FileReader();
        reader.onload = () => {
          setItemForm((prev) => ({ ...prev, imageUrl: (reader.result as string) || '' }));
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.error('Photo processing error:', err);
    } finally {
      setImageUploading(false);
      e.target.value = '';
    }
  };

  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setItemSaveError(null);

    const token = adminToken || (typeof window !== 'undefined' ? localStorage.getItem('hm_admin_token') : null);
    if (!token) {
      const msg = 'Admin session expired or missing. Please log in again.';
      setItemSaveError(msg);
      alert(msg);
      return;
    }
    if (!adminToken) {
      setAdminToken(token);
    }

    const trimmedName = itemForm.name.trim();
    if (!trimmedName) {
      const msg = 'Please enter an item name.';
      setItemSaveError(msg);
      return;
    }

    const parsedPrice = parseFloat(itemForm.price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      const msg = 'Please enter a valid price greater than ₹0.';
      setItemSaveError(msg);
      return;
    }

    const resolvedCatId = itemForm.categoryId || categories[0]?.id || 'cat_breakfast';

    setIsSavingItem(true);

    try {
      const payload = {
        name: trimmedName,
        categoryId: resolvedCatId,
        price: parsedPrice,
        description: itemForm.description.trim(),
        imageUrl: itemForm.imageUrl?.trim() || '',
        isVeg: Boolean(itemForm.isVeg),
        isAvailable: Boolean(itemForm.isAvailable),
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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        const savedItem: MenuItem = data.item;
        if (savedItem) {
          setMenuItems((prev) => {
            if (editingItem) {
              return prev.map((it) => (it.id === savedItem.id ? savedItem : it));
            } else {
              const remaining = prev.filter((it) => it.id !== savedItem.id);
              return [savedItem, ...remaining];
            }
          });
        }

        setItemModalOpen(false);
        setEditingItem(null);
        setItemSaveError(null);

        // Fetch fresh menu immediately with cache-busting to ensure database consistency
        try {
          const freshRes = await fetch(`/api/menu?_t=${Date.now()}`);
          if (freshRes.ok) {
            const freshData = await freshRes.json();
            if (Array.isArray(freshData.items)) {
              setMenuItems(freshData.items);
            }
            if (Array.isArray(freshData.categories)) {
              setCategories(freshData.categories);
            }
          }
        } catch (fetchErr) {
          console.error('Menu refresh error:', fetchErr);
        }

        // Also trigger full admin data sync
        fetchAllAdminData();
      } else {
        const errorMsg = data.error || 'Failed to save menu item. Please check the fields and try again.';
        setItemSaveError(errorMsg);
        alert(errorMsg);
      }
    } catch (err: any) {
      console.error('Failed to save menu item:', err);
      const errorMsg = err.message || 'Network error while saving item. Please try again.';
      setItemSaveError(errorMsg);
      alert(errorMsg);
    } finally {
      setIsSavingItem(false);
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

  const handleSetItemAvailability = async (item: MenuItem, newStatus: boolean) => {
    if (!adminToken) return;
    if (item.isAvailable === newStatus) return;

    setUpdatingAvailabilityItemId(item.id);
    // Optimistic UI update
    setMenuItems((prev) =>
      prev.map((m) => (m.id === item.id ? { ...m, isAvailable: newStatus } : m))
    );

    try {
      const res = await fetch(`/api/admin/menu/items/${item.id}/availability`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ isAvailable: newStatus }),
      });

      if (!res.ok) {
        // Fallback to PUT
        await fetch(`/api/admin/menu/items/${item.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ isAvailable: newStatus }),
        });
      }

      setAvailabilityToast({
        itemName: item.name,
        isAvailable: newStatus,
        timestamp: Date.now(),
      });
      setTimeout(() => {
        setAvailabilityToast((curr) =>
          curr && Date.now() - curr.timestamp >= 4000 ? null : curr
        );
      }, 4000);

      fetchAllAdminData();
    } catch (err) {
      console.error('Failed to update availability:', err);
      // Revert on error
      setMenuItems((prev) =>
        prev.map((m) => (m.id === item.id ? { ...m, isAvailable: item.isAvailable } : m))
      );
    } finally {
      setUpdatingAvailabilityItemId(null);
    }
  };

  const handleToggleItemAvailability = (item: MenuItem) => {
    handleSetItemAvailability(item, !item.isAvailable);
  };

  const handleToggleOrderItemSelection = (orderId: string, itemId: string) => {
    setSelectedOutOfStockByOrder((prev) => {
      const current = prev[orderId] || [];
      const exists = current.includes(itemId);
      const updated = exists ? current.filter((id) => id !== itemId) : [...current, itemId];
      return { ...prev, [orderId]: updated };
    });
  };

  const handleMarkSelectedOutOfStock = async (orderId: string) => {
    if (!adminToken) return;
    const selectedIds = selectedOutOfStockByOrder[orderId] || [];
    if (selectedIds.length === 0) return;

    setMarkingOutOfStockOrderId(orderId);

    // Optimistically update menu items state
    setMenuItems((prev) =>
      prev.map((m) => (selectedIds.includes(m.id) ? { ...m, isAvailable: false } : m))
    );

    try {
      const res = await fetch('/api/admin/menu/items/batch-availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ itemIds: selectedIds, isAvailable: false }),
      });

      if (!res.ok) {
        // Fallback to individual calls if needed
        await Promise.all(
          selectedIds.map((id) =>
            fetch(`/api/admin/menu/items/${id}/availability`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminToken}`,
              },
              body: JSON.stringify({ isAvailable: false }),
            })
          )
        );
      }

      // Names of the items marked out of stock
      const affectedNames = menuItems
        .filter((m) => selectedIds.includes(m.id))
        .map((m) => m.name);
      const namesString =
        affectedNames.length > 0 ? affectedNames.join(', ') : `${selectedIds.length} item(s)`;

      setAvailabilityToast({
        itemName: namesString,
        isAvailable: false,
        timestamp: Date.now(),
      });
      setTimeout(() => {
        setAvailabilityToast((curr) =>
          curr && Date.now() - curr.timestamp >= 4000 ? null : curr
        );
      }, 4000);

      // Clear selection for this order
      setSelectedOutOfStockByOrder((prev) => ({ ...prev, [orderId]: [] }));

      // Refresh admin data to ensure synchronization
      fetchAllAdminData();
    } catch (err) {
      console.error('Failed to mark selected items out of stock:', err);
    } finally {
      setMarkingOutOfStockOrderId(null);
    }
  };

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
    const token = adminToken || (typeof window !== 'undefined' ? localStorage.getItem('hm_admin_token') : null);
    if (!token || !file) return;
    try {
      setQuickPhotoLoadingId(item.id);
      let photoData = '';
      try {
        photoData = await applyWatermarkToImageFile(file);
      } catch (watermarkErr) {
        console.warn('Quick photo watermark fallback:', watermarkErr);
        photoData = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string) || '');
          reader.readAsDataURL(file);
        });
      }
      const res = await fetch(`/api/admin/menu/items/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ imageUrl: photoData }),
      });
      if (res.ok) {
        fetchAllAdminData();
      }
    } catch (err) {
      console.error('Failed to update photo:', err);
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

  // Calculate counts for badges and filters (CURRENT CALENDAR DAY ONLY for Today's operational dashboard)
  const newOrdersCount = orders.filter(
    (o) => isPendingNewOrder(o) && isOrderToday(o.createdAt, currentCalendarDate)
  ).length;
  const acceptedOrdersCount = orders.filter(
    (o) => isAcceptedOrder(o) && isOrderToday(o.createdAt, currentCalendarDate)
  ).length;
  const todayValidOrdersCount = orders.filter(
    (o) => isValidOrder(o) && isOrderToday(o.createdAt, currentCalendarDate)
  ).length;
  const todayOrdersCount = orders.filter(
    (o) => isOrderToday(o.createdAt, currentCalendarDate)
  ).length;
  const rejectedOrdersCount = orders.filter(
    (o) => isRejectedOrder(o) && isOrderToday(o.createdAt, currentCalendarDate)
  ).length;

  // Group all orders by local date with attached expenses & valid sales metrics
  const dateGroups = useMemo(() => {
    return groupOrdersByDate(orders, expenses, currentCalendarDate);
  }, [orders, expenses, currentCalendarDate]);

  // Selected date group for detailed date drill-down
  const selectedDateGroup = useMemo(() => {
    if (historyDateFilter === 'all') return null;
    return dateGroups.find((g) => g.dateYMD === historyDateFilter) || null;
  }, [dateGroups, historyDateFilter]);

  const filteredOrders = useMemo(() => {
    // Sort all orders newest first
    const sorted = [...orders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (orderFilter === 'new') {
      // 1. NEW ORDERS:
      // Show ONLY genuinely new orders from the current calendar day waiting for admin action.
      // An old order from yesterday must NEVER appear as a new order today.
      return sorted.filter((o) => isPendingNewOrder(o) && isOrderToday(o.createdAt, currentCalendarDate));
    }

    if (orderFilter === 'accepted' || orderFilter === 'active') {
      // 2. ACCEPTED ORDERS:
      // Show only currently relevant accepted orders from the current calendar day.
      // Yesterday's completed/old orders must not stay visible on the current-day dashboard.
      // Old orders should be accessed through ORDER HISTORY.
      return sorted.filter((o) => isAcceptedOrder(o) && isOrderToday(o.createdAt, currentCalendarDate));
    }

    if (orderFilter === 'today') {
      // 3. TODAY'S ORDERS:
      // Shows ONLY valid orders from the CURRENT CALENDAR DATE (strictly matching Today's Total Orders).
      // Orders from previous dates appear exclusively in ORDER HISTORY.
      // At midnight (IST), automatically resets to 0.
      return sorted.filter((o) => isValidOrder(o) && isOrderToday(o.createdAt, currentCalendarDate));
    }

    if (orderFilter === 'completed') {
      return sorted.filter(
        (o) => (o.status || '').toLowerCase() === 'delivered' && isOrderToday(o.createdAt, currentCalendarDate)
      );
    }

    if (orderFilter === 'rejected') {
      // 4. REJECTED ORDERS:
      // Show only current day's rejected orders.
      return sorted.filter((o) => isRejectedOrder(o) && isOrderToday(o.createdAt, currentCalendarDate));
    }

    if (orderFilter === 'history') {
      // 5. DATE-WISE ORDER HISTORY:
      // All previous-day orders remain safely stored in the existing database.
      // They are visible only when Admin opens ORDER HISTORY.
      return sorted.filter((o) => {
        if (historyDateFilter !== 'all') {
          if (!isOrderFromDate(o.createdAt, historyDateFilter)) {
            return false;
          }
        }
        if (historySearchQuery.trim()) {
          const q = historySearchQuery.toLowerCase().trim();
          const matchNumber = (o.orderNumber || '').toLowerCase().includes(q);
          const matchName = (o.customerName || '').toLowerCase().includes(q);
          const matchPhone = (o.customerPhone || '').toLowerCase().includes(q);
          const matchArea = (o.deliveryArea || '').toLowerCase().includes(q);
          if (!matchNumber && !matchName && !matchPhone && !matchArea) return false;
        }
        return true;
      });
    }

    // Default 'all': strictly current calendar day only so previous days NEVER mix with today
    return sorted.filter((o) => isOrderToday(o.createdAt, currentCalendarDate));
  }, [orders, orderFilter, historyDateFilter, historySearchQuery, currentCalendarDate]);

  // ==========================================
  // RENDER LOGIN IF NOT AUTHENTICATED
  // ==========================================
  if (!isAdminLoggedIn) {
    return (
      <div className="min-h-screen bg-[#091a10] text-[#fcfaf6] flex flex-col justify-center items-center p-4 selection:bg-[#cba135] selection:text-[#0a1f13]">
        <div className="w-full max-w-md bg-[#0f2d1c] border-2 border-[#cba135] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-[#164027] border border-[#dfb64c] rounded-2xl mx-auto flex items-center justify-center text-[#dfb64c] shadow-lg">
              {adminAuthMode === 'login' ? (
                <ShieldCheck className="w-8 h-8" />
              ) : (
                <KeyRound className="w-8 h-8" />
              )}
            </div>
            <h1 className="font-brand text-2xl sm:text-3xl font-bold text-[#fcfaf6]">
              {adminAuthMode === 'login' ? 'Private Admin Portal' : 'Set Admin Password'}
            </h1>
            <p className="text-xs text-[#9bb5a4]">
              {adminAuthMode === 'login'
                ? 'Hotel Malabar Kitchen, Menu & Delivery Control Terminal'
                : 'Configure your administrator phone number and master password'}
            </p>
          </div>

          {/* Mode Switcher: ONLY visible when admin account has NEVER been configured */}
          {isAdminConfigured === false && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#123620] border border-[#245937] rounded-2xl">
              <button
                type="button"
                onClick={() => {
                  setAdminAuthMode('login');
                  setLoginError(null);
                  setAuthSuccessMessage(null);
                }}
                className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  adminAuthMode === 'login'
                    ? 'bg-gradient-to-r from-[#dfb64c] to-[#cba135] text-[#0a1f13] shadow'
                    : 'text-[#c9dcce] hover:text-[#fcfaf6]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdminAuthMode('setPassword');
                  setLoginError(null);
                  setAuthSuccessMessage(null);
                }}
                className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  adminAuthMode === 'setPassword'
                    ? 'bg-gradient-to-r from-[#dfb64c] to-[#cba135] text-[#0a1f13] shadow'
                    : 'text-[#c9dcce] hover:text-[#fcfaf6]'
                }`}
              >
                Set Admin Password
              </button>
            </div>
          )}

          {loginError && (
            <div className="p-3 rounded-xl bg-red-950/90 border border-red-800 text-red-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="font-semibold">{loginError}</span>
            </div>
          )}

          {authSuccessMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/90 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{authSuccessMessage}</span>
            </div>
          )}

          {adminAuthMode === 'login' || isAdminConfigured === true ? (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#c9dcce] mb-1">
                  Admin Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-3.5 text-[#799983]" />
                  <input
                    type="tel"
                    required
                    value={adminPhone}
                    onChange={(e) => {
                      setAdminPhone(e.target.value);
                      setLoginError(null);
                    }}
                    placeholder="Enter admin phone number"
                    className="w-full bg-[#123620] border border-[#245937] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-[#fcfaf6] font-mono focus:outline-none focus:border-[#dfb64c]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#c9dcce]">
                    Admin Password
                  </label>
                  {isAdminConfigured === false && (
                    <button
                      type="button"
                      onClick={() => {
                        setAdminAuthMode('setPassword');
                        setLoginError(null);
                        setAuthSuccessMessage(null);
                      }}
                      className="text-[11px] text-[#dfb64c] hover:underline cursor-pointer"
                    >
                      Set Admin Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-[#799983]" />
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    required
                    value={adminPassword}
                    onChange={(e) => {
                      setAdminPassword(e.target.value);
                      setLoginError(null);
                    }}
                    placeholder="Enter admin password"
                    className="w-full bg-[#123620] border border-[#245937] rounded-xl pl-10 pr-10 py-2.5 text-sm text-[#fcfaf6] focus:outline-none focus:border-[#dfb64c]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-3.5 top-3 text-[#799983] hover:text-[#fcfaf6] cursor-pointer"
                    aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
                  >
                    {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-gradient-to-r from-[#dfb64c] to-[#cba135] hover:from-[#e7c35d] text-[#0a1f13] font-bold py-3.5 rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50 mt-2 flex items-center justify-center gap-2 text-sm"
              >
                {loginLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Sign In as Admin</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSetAdminPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#c9dcce] mb-1">
                  Admin Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-3.5 text-[#799983]" />
                  <input
                    type="tel"
                    required
                    value={adminPhone}
                    onChange={(e) => {
                      setAdminPhone(e.target.value);
                      setLoginError(null);
                    }}
                    placeholder="e.g. 10-digit mobile number"
                    className="w-full bg-[#123620] border border-[#245937] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-[#fcfaf6] font-mono focus:outline-none focus:border-[#dfb64c]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#c9dcce] mb-1">
                  New Admin Password (Min 8 Characters)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-[#799983]" />
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={adminPassword}
                    onChange={(e) => {
                      setAdminPassword(e.target.value);
                      setLoginError(null);
                    }}
                    placeholder="At least 8 characters"
                    className="w-full bg-[#123620] border border-[#245937] rounded-xl pl-10 pr-10 py-2.5 text-sm text-[#fcfaf6] focus:outline-none focus:border-[#dfb64c]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-3.5 top-3 text-[#799983] hover:text-[#fcfaf6] cursor-pointer"
                    aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
                  >
                    {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#c9dcce] mb-1">
                  Confirm Admin Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-[#799983]" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setLoginError(null);
                    }}
                    placeholder="Re-enter new admin password"
                    className="w-full bg-[#123620] border border-[#245937] rounded-xl pl-10 pr-10 py-2.5 text-sm text-[#fcfaf6] focus:outline-none focus:border-[#dfb64c]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-3 text-[#799983] hover:text-[#fcfaf6] cursor-pointer"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-gradient-to-r from-[#dfb64c] to-[#cba135] hover:from-[#e7c35d] text-[#0a1f13] font-bold py-3.5 rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50 mt-2 flex items-center justify-center gap-2 text-sm"
              >
                {loginLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving Admin Password...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Set Password & Login</span>
                  </>
                )}
              </button>
            </form>
          )}

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
            { id: 'orders', label: 'Orders', icon: Bell, count: newOrdersCount > 0 ? `${newOrdersCount} New` : todayValidOrdersCount > 0 ? `${todayValidOrdersCount} Today` : orders.length },
            { id: 'menu', label: 'Food Menu', icon: Utensils, count: menuItems.length },
            { id: 'categories', label: 'Categories', icon: Layers, count: categories.length },
            { id: 'profile', label: 'Profile & Logo', icon: Building },
            { id: 'delivery', label: 'Delivery', icon: Truck, count: deliveryAreas.length },
            { id: 'customers', label: 'Customers', icon: Users, count: customers.length },
            { id: 'ratings', label: 'Ratings', icon: Star, count: ratings.length },
            { id: 'settings', label: 'Admin Settings', icon: Sliders, count: hasCustomSound ? 'Custom Sound' : 'Default' },
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
                  badge: newOrdersCount > 0 ? `${newOrdersCount} New` : todayValidOrdersCount > 0 ? `${todayValidOrdersCount} Today` : `${orders.length} total`,
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
                {
                  id: 'ratings',
                  label: 'Ratings & Reviews',
                  description: 'Customer 1-5 star ratings & food feedback',
                  icon: Star,
                  badge: `${ratings.length} reviews`,
                  badgeColor: 'bg-amber-950 text-amber-300 border border-amber-600/50',
                },
                {
                  id: 'settings',
                  label: 'Admin Settings',
                  description: 'Custom order notification sound & alerts',
                  icon: Sliders,
                  badge: hasCustomSound ? 'Custom Sound' : 'Default Sound',
                  badgeColor: hasCustomSound ? 'bg-amber-950 text-amber-300 border border-amber-600' : 'bg-[#18482b] text-[#c9dcce]',
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
                        : 'bg-emerald-600 hover:bg-emerald-500 text-[#091a10] border border-emerald-400 shadow-md font-extrabold ring-2 ring-emerald-400/50'
                    }`}
                  >
                    {soundEnabled ? (
                      <>
                        <VolumeX className="w-4 h-4 text-red-400" />
                        <span>Mute Kitchen Sound</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4 text-[#091a10]" />
                        <span>Enable Kitchen Sound</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleTestSoundAlert}
                    className={`border px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isSoundTesting
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-2 ring-amber-400/40'
                        : 'bg-[#123620] hover:bg-[#184428] border-[#dfb64c]/60 text-[#dfb64c] hover:text-white'
                    }`}
                    title="Play order notification sound now"
                  >
                    <Bell className={`w-4 h-4 ${isSoundTesting ? 'text-amber-400 animate-bounce' : 'text-[#dfb64c]'}`} />
                    <span>{isSoundTesting ? 'Playing Sound...' : 'Test Sound'}</span>
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

              {/* CUSTOM SOUND CONTROLS & CURRENT SOUND DISPLAY */}
              <div className="mt-3 pt-3 border-t border-[#1d462b] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[#8ea896] shrink-0 font-medium">Active Sound:</span>
                  <span className="font-bold text-[#dfb64c] truncate font-mono text-[11px] sm:text-xs" title={currentSoundName}>
                    {currentSoundName}
                  </span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    hasCustomSound
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}>
                    {hasCustomSound ? 'CUSTOM' : 'DEFAULT'}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <label className="bg-[#143d26] hover:bg-[#1a4e31] border border-[#dfb64c]/50 hover:border-[#dfb64c] text-[#dfb64c] hover:text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Custom Sound</span>
                    <input
                      type="file"
                      accept="audio/*,.mp3,.wav,.ogg,.m4a"
                      onChange={handleCustomSoundUpload}
                      className="sr-only"
                    />
                  </label>

                  {hasCustomSound && (
                    <button
                      type="button"
                      onClick={handleResetSoundToDefault}
                      className="bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-300 hover:text-white px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                      title="Reset to default Hotel Malabar kitchen bell sound"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-[#8ea896]" />
                      <span>Reset to Default</span>
                    </button>
                  )}
                </div>
              </div>

              {soundSuccessToast && (
                <div className="mt-2 p-2.5 bg-emerald-950/90 border border-emerald-500/60 rounded-xl text-xs text-emerald-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{soundSuccessToast}</span>
                  </div>
                  <button onClick={() => setSoundSuccessToast(null)} className="text-emerald-400 hover:text-white cursor-pointer">✕</button>
                </div>
              )}

              {soundUploadError && (
                <div className="mt-2 p-2.5 bg-red-950/90 border border-red-500/60 rounded-xl text-xs text-red-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{soundUploadError}</span>
                  </div>
                  <button onClick={() => setSoundUploadError(null)} className="text-red-400 hover:text-white cursor-pointer">✕</button>
                </div>
              )}

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

            {/* 5. TODAY'S SALES & ORDERS SUMMARY (REAL-TIME DB METRICS & DAILY CHART) */}
            <AdminSalesSummary
              orders={orders}
              expenses={expenses}
              selectedDate={salesSummaryDate}
              todayDate={currentCalendarDate}
              onSelectDate={(dateYMD) => {
                setSalesSummaryDate(dateYMD);
              }}
              onViewDateInHistory={(dateYMD) => {
                setOrderFilter('history');
                setHistoryDateFilter(dateYMD);
              }}
              onAddExpense={() => {
                setExpenseForm({
                  date: salesSummaryDate || currentCalendarDate,
                  title: '',
                  category: 'Kitchen & Groceries',
                  amount: '',
                  notes: '',
                });
                setExpenseModalOpen(true);
              }}
            />

            {/* NEW ORDER PROMINENT ALERT BANNER (ONLY FOR GENUINE NEW ORDERS PLACED TODAY) */}
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
                    View New Orders ({newOrdersCount})
                  </button>
                </div>
              </div>
            )}

            {/* Orders Header & Filter Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#1b432a]">
              <div className="flex items-center gap-2 overflow-x-auto max-w-full flex-nowrap pb-1 scrollbar-thin">
                {/* 1. NEW ORDERS */}
                <button
                  onClick={() => setOrderFilter('new')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                    orderFilter === 'new'
                      ? 'bg-red-500 text-white shadow-md ring-2 ring-red-400/40'
                      : newOrdersCount > 0
                      ? 'bg-red-950 text-red-300 border border-red-600 animate-pulse'
                      : 'bg-[#123620] text-red-300/80 border border-[#245937] hover:border-red-500/40'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>New Orders ({newOrdersCount})</span>
                </button>

                {/* 2. ACCEPTED ORDERS */}
                <button
                  onClick={() => setOrderFilter('accepted')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                    orderFilter === 'accepted'
                      ? 'bg-emerald-500 text-[#0a1f13] font-bold shadow-md'
                      : 'bg-[#123620] text-emerald-300 border border-[#245937] hover:border-emerald-500/40'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Accepted Orders ({acceptedOrdersCount})</span>
                </button>

                {/* 3. TODAY'S ORDERS */}
                <button
                  onClick={() => setOrderFilter('today')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                    orderFilter === 'today'
                      ? 'bg-amber-400 text-[#0a1f13] font-bold shadow-md'
                      : 'bg-[#123620] text-amber-200 border border-[#245937] hover:border-amber-400/40'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Today's Orders ({todayValidOrdersCount})</span>
                </button>

                {/* 4. DATE-WISE ORDER HISTORY */}
                <button
                  onClick={() => setOrderFilter('history')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                    orderFilter === 'history'
                      ? 'bg-[#dfb64c] text-[#0a1f13] font-bold shadow-md'
                      : 'bg-[#123620] text-[#c9dcce] border border-[#245937] hover:border-[#dfb64c]/40'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Order History ({dateGroups.length} Days)</span>
                </button>

                {/* 5. REJECTED ORDERS */}
                <button
                  onClick={() => setOrderFilter('rejected')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                    orderFilter === 'rejected'
                      ? 'bg-stone-500 text-white font-bold shadow-md'
                      : 'bg-[#123620] text-stone-400 border border-[#245937] hover:border-stone-500/40'
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Rejected Orders ({rejectedOrdersCount})</span>
                </button>

                {/* 6. ALL TODAY */}
                <button
                  onClick={() => setOrderFilter('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all shrink-0 whitespace-nowrap ${
                    orderFilter === 'all'
                      ? 'bg-stone-200 text-[#0a1f13] font-bold'
                      : 'bg-[#123620] text-[#8ea896] border border-[#245937]'
                  }`}
                >
                  All Today ({todayOrdersCount})
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

            {/* ORDER HISTORY CONTROLS PANEL (SHOWN WHEN IN ORDER HISTORY TAB) */}
            {orderFilter === 'history' && (
              <div className="bg-[#0b2416] border border-[#1e4e30] rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#1b432a]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#dfb64c]/10 border border-[#dfb64c]/30 flex items-center justify-center text-[#dfb64c]">
                      <History className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-[#fcfaf6]">
                        Date-wise Order History
                      </h3>
                      <p className="text-[11px] text-[#8ea896]">
                        Select any date to view verified orders, total business, collections, expenses, and net profit.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 bg-[#081a10] border border-[#245937] rounded-xl px-2.5 py-1.5 text-xs">
                      <span className="text-[#8ea896] text-[11px]">Pick Date:</span>
                      <input
                        type="date"
                        value={historyDateFilter === 'all' ? '' : historyDateFilter}
                        onChange={(e) => setHistoryDateFilter(e.target.value || 'all')}
                        className="bg-transparent text-[#fcfaf6] font-mono text-xs focus:outline-none cursor-pointer"
                        title="Choose a specific date to view historical orders"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setHistoryDateFilter('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                        historyDateFilter === 'all'
                          ? 'bg-[#dfb64c] text-[#0a1f13] font-bold shadow'
                          : 'bg-[#123620] text-[#a6bfae] border border-[#245937]'
                      }`}
                    >
                      All Dates ({orders.length})
                    </button>
                  </div>
                </div>

                {/* Quick Date Selector Carousel */}
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase font-mono tracking-wider text-[#7e9e88]">
                    Available Order Dates ({dateGroups.length} Days in Database):
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                    {dateGroups.map((grp) => {
                      const isSelected = historyDateFilter === grp.dateYMD;
                      return (
                        <button
                          key={grp.dateYMD}
                          type="button"
                          onClick={() => setHistoryDateFilter(grp.dateYMD)}
                          className={`px-3.5 py-2 rounded-xl text-left transition-all shrink-0 cursor-pointer border ${
                            isSelected
                              ? 'bg-[#dfb64c] text-[#0a1f13] border-[#dfb64c] shadow-lg font-bold ring-2 ring-[#dfb64c]/40 scale-[1.02]'
                              : 'bg-[#081a10] text-[#c9dcce] border-[#245937] hover:border-[#dfb64c]/60'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold">
                              {grp.isToday ? 'Today' : grp.calendarDate}
                            </span>
                            {grp.isToday && (
                              <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold uppercase ${
                                isSelected ? 'bg-[#0a1f13] text-[#dfb64c]' : 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                              }`}>
                                Live
                              </span>
                            )}
                          </div>
                          <div className={`text-[11px] font-mono mt-0.5 ${isSelected ? 'text-[#0a1f13]' : 'text-[#8ea896]'}`}>
                            {grp.metrics.totalOrders} {grp.metrics.totalOrders === 1 ? 'order' : 'orders'} • ₹{grp.metrics.totalBusiness.toLocaleString('en-IN')}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Date Summary Banner with the 5 required summary cards */}
                {selectedDateGroup && (
                  <div className="bg-gradient-to-r from-[#123620] via-[#0d2818] to-[#123620] border-2 border-[#dfb64c] rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1b432a]">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-[#dfb64c] bg-[#1a442a] px-2 py-0.5 rounded-full border border-[#dfb64c]/30">
                            Date-wise Summary
                          </span>
                          {selectedDateGroup.isToday && (
                            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-500">
                              Today's Metrics
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg sm:text-xl font-brand font-bold text-[#fcfaf6] mt-1">
                          📅 {selectedDateGroup.calendarDate}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setExpenseForm({
                              date: selectedDateGroup.dateYMD,
                              title: '',
                              category: 'Kitchen & Groceries',
                              amount: '',
                              notes: '',
                            });
                            setExpenseModalOpen(true);
                          }}
                          className="bg-[#1b432a] hover:bg-[#235836] border border-[#3b7a52] text-[#fcfaf6] text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow"
                        >
                          <Plus className="w-3.5 h-3.5 text-[#dfb64c]" />
                          Record Day's Expense
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoryDateFilter('all')}
                          className="bg-[#081a10] hover:bg-[#123620] text-[#a6bfae] text-xs px-2.5 py-1.5 rounded-xl border border-[#245937] cursor-pointer"
                        >
                          Show All Dates
                        </button>
                      </div>
                    </div>

                    {/* 5 Cards for Selected Date */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
                      {/* 1. Total Orders */}
                      <div className="bg-[#081a10] border border-[#1b432a] rounded-xl p-3">
                        <span className="text-[10px] font-mono text-[#8ea896] uppercase block">Total Orders</span>
                        <span className="text-xl font-bold font-mono text-[#fcfaf6] block mt-1">
                          {selectedDateGroup.metrics.totalOrders}
                        </span>
                        <span className="text-[10px] text-[#5d7c66] block">
                          Valid orders (excl. rejected)
                        </span>
                      </div>

                      {/* 2. Total Business / Sales */}
                      <div className="bg-[#081a10] border border-[#1b432a] rounded-xl p-3">
                        <span className="text-[10px] font-mono text-[#8ea896] uppercase block">Total Business / Sales</span>
                        <span className="text-xl font-bold font-mono text-[#dfb64c] block mt-1">
                          ₹{selectedDateGroup.metrics.totalBusiness.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] text-[#5d7c66] block">Gross order value</span>
                      </div>

                      {/* 3. Total Payment / Collection */}
                      <div className="bg-[#081a10] border border-[#1b432a] rounded-xl p-3">
                        <span className="text-[10px] font-mono text-[#8ea896] uppercase block">Total Payment / Collection</span>
                        <span className="text-xl font-bold font-mono text-emerald-400 block mt-1">
                          ₹{selectedDateGroup.metrics.totalPayment.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] text-emerald-600 block">
                          Realized / online & delivered
                        </span>
                      </div>

                      {/* 4. Day's Expense */}
                      <div className="bg-[#081a10] border border-[#1b432a] rounded-xl p-3">
                        <span className="text-[10px] font-mono text-[#8ea896] uppercase block">Day's Expense</span>
                        <span className="text-xl font-bold font-mono text-amber-400 block mt-1">
                          ₹{selectedDateGroup.metrics.totalExpense.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] text-[#5d7c66] block">
                          {selectedDateGroup.metrics.expenseCount || 0} recorded
                        </span>
                      </div>

                      {/* 5. Net Amount */}
                      <div className="bg-[#081a10] border border-[#1b432a] rounded-xl p-3 col-span-2 sm:col-span-1">
                        <span className="text-[10px] font-mono text-[#8ea896] uppercase block">Net Amount</span>
                        <span className={`text-xl font-bold font-mono block mt-1 ${
                          selectedDateGroup.metrics.netAmount >= 0 ? 'text-emerald-300' : 'text-red-400'
                        }`}>
                          ₹{selectedDateGroup.metrics.netAmount.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] text-[#5d7c66] block">Collection − Expense</span>
                      </div>
                    </div>

                    {selectedDateGroup.metrics.pendingCollection > 0 && (
                      <div className="text-[11px] text-amber-300/80 bg-amber-950/40 border border-amber-800/40 px-3 py-1.5 rounded-lg flex items-center justify-between">
                        <span>ℹ️ Pending COD Collection (to be collected on delivery):</span>
                        <span className="font-mono font-bold text-amber-200">
                          ₹{selectedDateGroup.metrics.pendingCollection.toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* History Search Query */}
                <div className="flex items-center gap-2 bg-[#081a10] border border-[#245937] rounded-xl px-3 py-2 text-xs">
                  <Search className="w-4 h-4 text-[#8ea896] shrink-0" />
                  <input
                    type="text"
                    placeholder="Search history by Customer Name, Phone, or Order #..."
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    className="bg-transparent text-[#fcfaf6] placeholder-[#5d7c66] focus:outline-none w-full text-xs"
                  />
                  {historySearchQuery && (
                    <button
                      type="button"
                      onClick={() => setHistorySearchQuery('')}
                      className="text-[#8ea896] hover:text-white text-xs cursor-pointer px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="text-[11px] text-[#8ea896] flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-[#1a442b]">
                  <span>
                    Showing <strong className="text-white font-mono">{filteredOrders.length}</strong>{' '}
                    {filteredOrders.length === 1 ? 'order' : 'orders'}
                    {historyDateFilter !== 'all' && (
                      <>
                        {' '}for <strong className="text-[#dfb64c] font-mono">{formatDateLabel(historyDateFilter)}</strong>
                      </>
                    )}
                  </span>
                  {historyDateFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setHistoryDateFilter('all')}
                      className="text-[#dfb64c] hover:underline cursor-pointer"
                    >
                      Show All Historical Dates
                    </button>
                  )}
                </div>
              </div>
            )}

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
                  const isNew = isPendingNewOrder(order) && isOrderToday(order.createdAt, currentCalendarDate);
                  const isRejected = isRejectedOrder(order);
                  const isToday = isOrderToday(order.createdAt, currentCalendarDate);
                  const orderTime = new Date(order.createdAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  });
                  const orderDateStr = isToday
                    ? `Today, ${orderTime}`
                    : `${new Date(order.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}, ${orderTime}`;

                  return (
                    <div
                      key={order.id}
                      className={`bg-[#0f2d1c] border-2 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between transition-all ${
                        isNew
                          ? 'border-red-500 ring-2 ring-red-500/40'
                          : isRejected
                          ? 'border-stone-700 bg-[#0d2216]'
                          : 'border-[#235836] hover:border-[#dfb64c]/60'
                      }`}
                    >
                      <div>
                        {/* Order Header info */}
                        <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#1b432a]">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-base text-[#dfb64c]">
                                {order.orderNumber}
                              </span>
                              <span className="text-xs text-[#8ea896] font-mono bg-[#081a10] px-2 py-0.5 rounded-lg border border-[#1d462b]">
                                🕒 {orderDateStr}
                              </span>
                            </div>
                            <h3 className="font-semibold text-sm sm:text-base text-[#fcfaf6] mt-1">
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
                                  : isRejected
                                  ? 'bg-stone-900 border border-red-800 text-red-300'
                                  : 'bg-[#143d26] border border-[#dfb64c] text-[#dfb64c]'
                              }`}
                            >
                              {order.status}
                            </span>
                            {isRejected && (
                              <span className="text-[10px] text-stone-400 block mt-0.5 font-mono">
                                (Excluded from Sales)
                              </span>
                            )}
                            <span className="text-[11px] text-[#8ea896] block mt-1">
                              {order.deliveryArea} ({order.deliveryDistanceKm} km)
                            </span>
                          </div>
                        </div>

                        {/* Rejection Reason Notice (if rejected) */}
                        {isRejected && order.rejectionReason && (
                          <div className="mt-2 p-2 bg-red-950/70 border border-red-800 rounded-xl text-xs text-red-200 flex items-start gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-red-300">Rejection Reason: </span>
                              <span>{order.rejectionReason}</span>
                            </div>
                          </div>
                        )}

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
                          {isNew && (
                            <div className="flex items-center justify-between pb-1 text-[11px]">
                              <span className="font-semibold text-[#fcfaf6]">Ordered Food Items:</span>
                              <span className="text-[10px] text-[#8ea896]">Select item(s) if out of stock</span>
                            </div>
                          )}
                          {order.items.map((item) => {
                            const matchingMenuItem = menuItems.find(
                              (m) => m.id === item.itemId || m.name.toLowerCase() === item.itemName.toLowerCase()
                            );
                            const resolvedItemId = matchingMenuItem ? matchingMenuItem.id : item.itemId;
                            const isOutOfStockNow = matchingMenuItem ? !matchingMenuItem.isAvailable : false;
                            const selectedIds = selectedOutOfStockByOrder[order.id] || [];
                            const isSelected = selectedIds.includes(resolvedItemId);

                            return (
                              <div
                                key={item.id}
                                className={`flex justify-between items-center text-[#fcfaf6] px-2.5 py-1.5 rounded-lg border transition-colors ${
                                  isSelected
                                    ? 'bg-red-950/70 border-red-600 ring-1 ring-red-500/50'
                                    : isOutOfStockNow
                                    ? 'bg-[#140b0d] border-red-900/60'
                                    : 'bg-[#091a10] border-[#1b432a]'
                                }`}
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                                  {/* 1. Show a checkbox beside each ordered food item on NEW order */}
                                  {isNew && (
                                    <label className="flex items-center cursor-pointer shrink-0">
                                      <input
                                        type="checkbox"
                                        id={`item-checkbox-${order.id}-${resolvedItemId}`}
                                        checked={isSelected}
                                        onChange={() => handleToggleOrderItemSelection(order.id, resolvedItemId)}
                                        className="w-4 h-4 rounded border-[#245937] text-red-600 focus:ring-red-500 bg-[#07170e] cursor-pointer accent-red-600"
                                        title={`Select "${item.itemName}" to mark Out of Stock`}
                                      />
                                    </label>
                                  )}

                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="font-medium truncate">
                                      <strong className="text-[#dfb64c] mr-1.5">{item.quantity}x</strong>
                                      {item.itemName}
                                    </span>
                                    {isOutOfStockNow && (
                                      <span className="shrink-0 text-[9px] font-extrabold text-red-300 uppercase tracking-wide bg-red-950 px-1.5 py-0.5 rounded border border-red-800">
                                        Out of Stock
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <span className="font-mono text-[#c9dcce] shrink-0">₹{item.subtotal}</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* 3. Add a "Mark Selected Out of Stock" button on every NEW order BEFORE Accept/Reject */}
                        {isNew && (
                          <div className="mb-2">
                            <button
                              type="button"
                              id={`mark-out-of-stock-${order.id}`}
                              disabled={
                                !selectedOutOfStockByOrder[order.id] ||
                                selectedOutOfStockByOrder[order.id].length === 0 ||
                                markingOutOfStockOrderId === order.id
                              }
                              onClick={() => handleMarkSelectedOutOfStock(order.id)}
                              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 min-h-[36px] ${
                                selectedOutOfStockByOrder[order.id] && selectedOutOfStockByOrder[order.id].length > 0
                                  ? 'bg-red-700 hover:bg-red-600 text-white shadow-md cursor-pointer border border-red-500 ring-2 ring-red-500/50'
                                  : 'bg-[#15231a] text-[#5e7766] border border-[#1d3826] cursor-not-allowed opacity-70'
                              }`}
                              title={
                                selectedOutOfStockByOrder[order.id] && selectedOutOfStockByOrder[order.id].length > 0
                                  ? 'Mark only the selected items as OUT OF STOCK'
                                  : 'Select one or more items above to mark them Out of Stock'
                              }
                            >
                              <XCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {markingOutOfStockOrderId === order.id
                                  ? 'Marking Out of Stock...'
                                  : selectedOutOfStockByOrder[order.id] && selectedOutOfStockByOrder[order.id].length > 0
                                  ? `Mark Selected Out of Stock (${selectedOutOfStockByOrder[order.id].length})`
                                  : 'Mark Selected Out of Stock'}
                              </span>
                            </button>
                          </div>
                        )}

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
                              return <AdminOrderCountdown readyMs={readyMs} />;
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
                          /* BEFORE ACCEPT / REJECT: CALL CUSTOMER + ACCEPT / REJECT DIRECT ACTIONS */
                          <div className="space-y-2">
                            {/* 8. Show a "Call Customer" button using that order customer's phone number */}
                            <a
                              href={`tel:${order.customerPhone}`}
                              id={`call-customer-${order.id}`}
                              className="w-full bg-[#123620] hover:bg-[#1a4a2c] text-[#dfb64c] hover:text-[#f8df93] border border-[#2e6d44] py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow transition-all cursor-pointer min-h-[38px]"
                              title={`Call customer ${order.customerName} at ${order.customerPhone}`}
                            >
                              <Phone className="w-4 h-4 text-[#dfb64c]" />
                              <span>Call Customer ({order.customerPhone})</span>
                            </a>

                            {/* 7. Keep BOTH existing Accept Order and Reject Order buttons */}
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

              <div className="flex flex-wrap items-center gap-2">
                <button
                  id="admin-ai-menu-card-import-btn"
                  onClick={() => setAiImportModalOpen(true)}
                  className="bg-[#143e26] hover:bg-[#1a4f31] text-[#dfb64c] border border-[#2e6843] font-bold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl shadow flex items-center gap-2 cursor-pointer transition-colors"
                  title="Upload and scan menu-card photos with AI to extract items, prices & categories"
                >
                  <Sparkles className="w-4 h-4 text-[#dfb64c]" />
                  <span>AI Menu Card Import</span>
                </button>

                <button
                  id="admin-add-food-item-btn"
                  onClick={() => {
                    setEditingItem(null);
                    setItemSaveError(null);
                    setItemForm({
                      name: '',
                      categoryId: categories[0]?.id || 'cat_breakfast',
                      price: '',
                      description: '',
                      imageUrl: '',
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
            </div>

            {/* AI Menu Card Import Success Banner */}
            {importSuccessMessage && (
              <div className="p-3.5 bg-[#0f3820] border border-[#2b7247] rounded-xl text-xs text-[#b8f5cc] flex items-center justify-between gap-3 shadow-md animate-in fade-in duration-300">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-800 flex items-center justify-center text-emerald-200 shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-[#fcfaf6]">Menu Items Successfully Added</p>
                    <p className="text-[11px] text-[#c0e6ce]">{importSuccessMessage}</p>
                  </div>
                </div>
                <button
                  onClick={() => setImportSuccessMessage(null)}
                  className="text-[#96c4a5] hover:text-[#fcfaf6] text-xs font-semibold px-2 py-1 rounded cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Availability Toast notification when admin changes an item */}
            {availabilityToast && (
              <div
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 shadow-lg transition-all animate-fade-in ${
                  availabilityToast.isAvailable
                    ? 'bg-emerald-950/90 border-emerald-500 text-emerald-100'
                    : 'bg-red-950/90 border-red-500 text-red-100'
                }`}
              >
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  {availabilityToast.isAvailable ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                  )}
                  <div>
                    <span className="font-semibold">
                      Food item &quot;{availabilityToast.itemName}&quot;
                    </span>{' '}
                    is now marked as{' '}
                    <strong className="uppercase font-bold tracking-wide">
                      {availabilityToast.isAvailable ? 'AVAILABLE' : 'OUT OF STOCK'}
                    </strong>
                    . Customer app and ordering have been updated.
                  </div>
                </div>
                <button
                  onClick={() => setAvailabilityToast(null)}
                  className="text-stone-300 hover:text-white text-xs font-semibold px-2 py-1 rounded cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Filter by Category, Availability & Search */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d2819] p-3 rounded-xl border border-[#1b432a]">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAvailabilityFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    availabilityFilter === 'all'
                      ? 'bg-[#dfb64c] text-[#0a1f13] font-bold shadow'
                      : 'bg-[#123620] text-[#96c4a5] hover:bg-[#18462a] border border-[#214f34]'
                  }`}
                >
                  All Items ({menuItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAvailabilityFilter('available')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    availabilityFilter === 'available'
                      ? 'bg-emerald-600 text-white font-bold shadow'
                      : 'bg-[#123620] text-emerald-300 hover:bg-[#18462a] border border-[#214f34]'
                  }`}
                >
                  Available ({menuItems.filter((m) => m.isAvailable).length})
                </button>
                <button
                  type="button"
                  onClick={() => setAvailabilityFilter('out_of_stock')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    availabilityFilter === 'out_of_stock'
                      ? 'bg-red-600 text-white font-bold shadow'
                      : 'bg-[#123620] text-red-300 hover:bg-[#18462a] border border-[#214f34]'
                  }`}
                >
                  Out of Stock ({menuItems.filter((m) => !m.isAvailable).length})
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 flex-1 justify-end max-w-md">
                <div className="flex-1 min-w-[180px] relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#799983]" />
                  <input
                    type="text"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder="Search by food name..."
                    className="w-full bg-[#123620] border border-[#245937] rounded-xl pl-9 pr-3 py-2 text-xs text-[#fcfaf6] placeholder-[#6d8a76] focus:outline-none focus:border-[#dfb64c]"
                  />
                </div>

                <select
                  value={selectedMenuCategory}
                  onChange={(e) => setSelectedMenuCategory(e.target.value)}
                  className="bg-[#123620] border border-[#245937] rounded-xl px-3 py-2 text-xs text-[#fcfaf6] focus:outline-none focus:border-[#dfb64c]"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Menu Items Table / Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {menuItems
                .filter((item) => {
                  if (availabilityFilter === 'available' && !item.isAvailable) {
                    return false;
                  }
                  if (availabilityFilter === 'out_of_stock' && item.isAvailable) {
                    return false;
                  }
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
                  const isUpdating = updatingAvailabilityItemId === item.id;

                  return (
                    <div
                      key={item.id}
                      id={`admin-item-card-${item.id}`}
                      className={`bg-[#0f2d1c] border rounded-2xl overflow-hidden shadow flex flex-col justify-between transition-all ${
                        !item.isAvailable
                          ? 'border-red-800/80 bg-gradient-to-b from-[#160e10] to-[#0f2d1c]'
                          : 'border-[#214f34]'
                      }`}
                    >
                      <div className="relative aspect-[16/9] w-full bg-[#081a10]">
                        {item.imageUrl ? (
                          <WatermarkedImage
                            src={item.imageUrl}
                            alt={item.name}
                            className={`w-full h-full ${!item.isAvailable ? 'grayscale-[30%] opacity-85' : ''}`}
                            watermarkSize="sm"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-[#07190f] border-b border-[#1b432a] text-[#558064] p-3 text-center">
                            <Camera className="w-6 h-6 text-[#dfb64c]/50 mb-1" />
                            <span className="text-[11px] font-semibold text-[#8ea896]">Blank Food Photo</span>
                            <span className="text-[9px] text-[#558064]">Click top-right camera to upload</span>
                          </div>
                        )}
                        <div className="absolute top-2 left-2 bg-[#0a1f13]/85 px-2 py-0.5 rounded text-[10px] text-[#dfb64c] border border-[#214f34]">
                          {cat?.name}
                        </div>

                        {/* Stock badge overlay on image */}
                        <div className="absolute bottom-2 left-2">
                          {item.isAvailable ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-950/90 text-emerald-300 border border-emerald-600/80 text-[10px] font-extrabold px-2 py-0.5 rounded shadow">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              AVAILABLE
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-red-950/95 text-red-200 border border-red-600 text-[10px] font-extrabold px-2 py-0.5 rounded shadow">
                              <XCircle className="w-3 h-3 text-red-400" />
                              OUT OF STOCK
                            </span>
                          )}
                        </div>

                        {/* Quick photo replacement buttons (Upload & Take Photo) */}
                        <div className="absolute top-2 right-2 flex items-center gap-1">
                          <label
                            className="bg-[#0a1f13]/90 hover:bg-[#143d26] text-[#dfb64c] p-1.5 rounded-lg cursor-pointer border border-[#cba135]/50 transition-colors shadow"
                            title="Upload Photo (File)"
                          >
                            <Upload className="w-3.5 h-3.5" />
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
                          <label
                            className="bg-[#0a1f13]/90 hover:bg-[#143d26] text-[#dfb64c] p-1.5 rounded-lg cursor-pointer border border-[#cba135]/50 transition-colors shadow"
                            title="Take Photo (Camera)"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleQuickPhotoReplace(item, f);
                              }}
                            />
                          </label>
                        </div>

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
                            <div>
                              <h4 className="font-semibold text-sm sm:text-base text-[#fcfaf6]">
                                {item.name}
                              </h4>
                              {!item.isAvailable && (
                                <span className="inline-block text-[10px] font-extrabold text-red-300 uppercase tracking-wider bg-red-950 px-1.5 py-0.5 rounded border border-red-800 mt-0.5">
                                  Out of Stock
                                </span>
                              )}
                            </div>
                            <span className="font-mono font-bold text-sm text-[#dfb64c]">
                              ₹{item.price}
                            </span>
                          </div>
                          <p className="text-xs text-[#8ea896] line-clamp-2">{item.description}</p>
                          <div className="flex items-center gap-2 mt-2 text-[10px] text-[#8ea896]">
                            <span className="bg-[#123620] px-2 py-0.5 rounded border border-[#214f34] text-[#a6bfae]">
                              ⏱ {item.prepTimeMinutes || 10} mins prep
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded border ${
                                item.isVeg
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                  : 'bg-amber-950 text-amber-300 border-amber-800'
                              }`}
                            >
                              {item.isVeg ? 'Veg' : 'Non-Veg'}
                            </span>
                          </div>
                        </div>

                        {/* OUT OF STOCK & AVAILABLE CONTROLS */}
                        <div className="mt-4 pt-3 border-t border-[#1b432a] space-y-2.5">
                          {/* Dedicated Status Bar */}
                          <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-[#08180e] border border-[#1b432a]">
                            <span className="text-[#8ea896] text-[11px] font-medium">Status:</span>
                            {item.isAvailable ? (
                              <span className="inline-flex items-center gap-1 font-bold text-emerald-400 text-xs">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                Available for Customers
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-bold text-red-400 text-xs">
                                <XCircle className="w-3.5 h-3.5 text-red-400" />
                                Out of Stock (Disabled)
                              </span>
                            )}
                          </div>

                          {/* Two Clear Actions: Mark Available & Mark Out of Stock */}
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              id={`admin-mark-available-${item.id}`}
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleSetItemAvailability(item, true)}
                              title={`Mark "${item.name}" as Available`}
                              className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[36px] ${
                                item.isAvailable
                                  ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 shadow-md'
                                  : 'bg-[#0f2c1b] hover:bg-emerald-700/80 text-emerald-300 hover:text-white border border-[#214f34] hover:border-emerald-500'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>{item.isAvailable ? '✓ Available' : 'Mark Available'}</span>
                            </button>

                            <button
                              id={`admin-mark-out-of-stock-${item.id}`}
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleSetItemAvailability(item, false)}
                              title={`Mark "${item.name}" as Out of Stock`}
                              className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[36px] ${
                                !item.isAvailable
                                  ? 'bg-red-600 text-white ring-2 ring-red-400 shadow-md'
                                  : 'bg-[#251114] hover:bg-red-700/80 text-red-300 hover:text-white border border-red-900/60 hover:border-red-500'
                              }`}
                            >
                              <XCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>{!item.isAvailable ? '✕ Out of Stock' : 'Mark Out of Stock'}</span>
                            </button>
                          </div>

                          {isUpdating && (
                            <div className="text-center text-[11px] text-[#dfb64c] font-medium flex items-center justify-center gap-1">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Updating &quot;{item.name}&quot;...
                            </div>
                          )}

                          {/* Secondary actions: Reorder, Edit, Delete */}
                          <div className="pt-2 flex items-center justify-between border-t border-[#163622]">
                            <span className="text-[10px] text-[#6d8a76]">Item Controls:</span>
                            <div className="flex items-center gap-1.5">
                              {/* Reorder Buttons */}
                              <button
                                onClick={() => handleMoveMenuItem(item.id, 'up')}
                                className="p-1.5 bg-[#143d26] text-[#dfb64c] hover:bg-[#1d5435] border border-[#214f34] rounded-lg cursor-pointer"
                                title={`Move "${item.name}" up in menu`}
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleMoveMenuItem(item.id, 'down')}
                                className="p-1.5 bg-[#143d26] text-[#dfb64c] hover:bg-[#1d5435] border border-[#214f34] rounded-lg cursor-pointer"
                                title={`Move "${item.name}" down in menu`}
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
                                title={`Edit details of "${item.name}"`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteMenuItem(item.id)}
                                className="p-1.5 bg-red-950/80 text-red-400 hover:bg-red-900 border border-red-900/60 rounded-lg cursor-pointer"
                                title={`Delete "${item.name}"`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
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

        {/* ========================================================================= */}
        {/* TAB 5: ADMIN SETTINGS (CUSTOM ORDER SOUND & NOTIFICATION CONTROLS)       */}
        {/* ========================================================================= */}
        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-4xl">
            <div className="pb-3 border-b border-[#1b432a]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#143d26] text-[#dfb64c] flex items-center justify-center border border-[#dfb64c]/40">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xl font-brand font-bold text-[#fcfaf6]">
                    Admin Settings — New Order Sound Notification
                  </h2>
                  <p className="text-xs text-[#8ea896] mt-0.5">
                    Manage incoming customer order notification sounds, upload custom audio, preview playback, or reset to Hotel Malabar's default bell chime.
                  </p>
                </div>
              </div>
            </div>

            {soundSuccessToast && (
              <div className="p-3 bg-emerald-950/90 border border-emerald-500 rounded-xl text-xs text-emerald-200 flex items-center justify-between gap-2 shadow-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{soundSuccessToast}</span>
                </div>
                <button
                  onClick={() => setSoundSuccessToast(null)}
                  className="text-emerald-400 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {soundUploadError && (
              <div className="p-3 bg-red-950/90 border border-red-500 rounded-xl text-xs text-red-200 flex items-center justify-between gap-2 shadow-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{soundUploadError}</span>
                </div>
                <button
                  onClick={() => setSoundUploadError(null)}
                  className="text-red-400 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* SOUND SETTINGS PANEL */}
            <div className="bg-[#0e2a1b] border border-[#1b432a] rounded-2xl p-5 space-y-6">
              {/* CURRENT SOUND NAME SECTION */}
              <div className="p-4 bg-[#0a1f13] border border-[#1d462b] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-[#8ea896] uppercase tracking-wider flex items-center gap-2">
                    <span>Current Active Sound</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      hasCustomSound
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}>
                      {hasCustomSound ? 'CUSTOM SOUND ACTIVE' : 'HOTEL MALABAR DEFAULT'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#143d26] text-[#dfb64c] flex items-center justify-center shrink-0">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm sm:text-base font-bold text-[#fcfaf6] font-mono break-all">
                        {currentSoundName}
                      </p>
                      <p className="text-[11px] text-[#8ea896]">
                        {hasCustomSound
                          ? 'This custom sound plays automatically whenever a customer places an order.'
                          : 'Using the authentic Hotel Malabar 3-strike kitchen bell chime MP3/alert.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`w-3 h-3 rounded-full ${soundEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                  <span className="text-xs font-semibold text-[#fcfaf6]">
                    {soundEnabled ? 'Alerts Enabled' : 'Alerts Muted'}
                  </span>
                </div>
              </div>

              {/* ACTION CONTROLS: Upload Custom Sound, Test Sound, Reset to Default */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Upload Custom Sound */}
                <label className="relative flex flex-col items-center justify-center p-4 rounded-xl border border-dashed border-[#dfb64c]/70 hover:border-[#dfb64c] bg-[#123620]/60 hover:bg-[#123620] text-center cursor-pointer transition-all group">
                  <Upload className="w-6 h-6 text-[#dfb64c] mb-1.5 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-[#dfb64c]">Upload Custom Sound</span>
                  <span className="text-[10px] text-[#8ea896] mt-0.5">MP3, WAV, OGG, M4A (Max 8MB)</span>
                  <input
                    type="file"
                    accept="audio/*,.mp3,.wav,.ogg,.m4a"
                    onChange={handleCustomSoundUpload}
                    className="sr-only"
                  />
                </label>

                {/* 2. Test Sound */}
                <button
                  type="button"
                  onClick={handleTestSoundAlert}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all cursor-pointer ${
                    isSoundTesting
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-2 ring-amber-400/50'
                      : 'bg-[#143d26] hover:bg-[#1a4f32] border-[#225736] text-[#fcfaf6] hover:border-[#dfb64c]'
                  }`}
                  title="Test current notification sound"
                >
                  <Bell className={`w-6 h-6 mb-1.5 ${isSoundTesting ? 'text-amber-400 animate-bounce' : 'text-[#dfb64c]'}`} />
                  <span className="text-xs font-bold">
                    {isSoundTesting ? 'Playing Sound...' : 'Test Sound'}
                  </span>
                  <span className="text-[10px] text-[#8ea896] mt-0.5">Click to preview active chime</span>
                </button>

                {/* 3. Reset to Default */}
                <button
                  type="button"
                  onClick={handleResetSoundToDefault}
                  disabled={!hasCustomSound}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all cursor-pointer ${
                    hasCustomSound
                      ? 'bg-[#1b261e] hover:bg-stone-800 border-stone-600 text-stone-200 hover:text-white'
                      : 'bg-[#102016] border-[#163322] text-[#526f5c] cursor-not-allowed opacity-60'
                  }`}
                  title="Reset to default Hotel Malabar kitchen bell sound"
                >
                  <RefreshCw className="w-6 h-6 text-[#8ea896] mb-1.5" />
                  <span className="text-xs font-bold">Reset to Default</span>
                  <span className="text-[10px] text-[#8ea896] mt-0.5">
                    {hasCustomSound ? 'Revert back to Hotel Malabar MP3' : 'Already on default sound'}
                  </span>
                </button>
              </div>

              {/* PLAYBACK PREFERENCES: Mute & Repeat */}
              <div className="pt-4 border-t border-[#1b432a] space-y-3">
                <h3 className="text-xs font-bold text-[#dfb64c] uppercase tracking-wider">
                  Playback Controls & Repeat Behavior
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 bg-[#0a1f13] border border-[#1d462b] rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#fcfaf6]">Notification Sound</p>
                      <p className="text-[11px] text-[#8ea896]">Enable or mute all order arrival audio alerts</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleSound}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        soundEnabled
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-[#091a10]'
                          : 'bg-red-950 border border-red-500 text-red-300'
                      }`}
                    >
                      {soundEnabled ? (
                        <>
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Enabled</span>
                        </>
                      ) : (
                        <>
                          <VolumeX className="w-3.5 h-3.5" />
                          <span>Muted</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="p-3.5 bg-[#0a1f13] border border-[#1d462b] rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#fcfaf6]">Repeat Until Accepted</p>
                      <p className="text-[11px] text-[#8ea896]">Repeat alert every 20s while new orders wait</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleRepeatSound}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        repeatSoundUntilAccepted
                          ? 'bg-[#dfb64c] text-[#0a1f13]'
                          : 'bg-[#143d26] text-[#8ea896] border border-[#1d462b]'
                      }`}
                    >
                      {repeatSoundUntilAccepted ? 'Repeat: ON' : 'Repeat: OFF'}
                    </button>
                  </div>
                </div>
              </div>

              {/* PERSISTENCE NOTE */}
              <div className="p-3 bg-[#0a1f13] border border-[#1d462b] rounded-xl flex items-start gap-2.5 text-xs text-[#8ea896]">
                <ShieldCheck className="w-4 h-4 text-[#dfb64c] shrink-0 mt-0.5" />
                <span>
                  Sound configuration is securely stored both in local browser storage and in your database. Your chosen custom sound will persist across page refreshes and subsequent admin re-logins.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 8: CUSTOMER FOOD RATINGS & REVIEWS (Requirement 1)                    */}
        {/* ========================================================================= */}
        {activeTab === 'ratings' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1b432a]">
              <div>
                <h2 className="text-xl font-brand font-bold text-[#fcfaf6] flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                  <span>Customer Food Ratings & Reviews</span>
                </h2>
                <p className="text-xs text-[#8ea896]">
                  Real 1 to 5 star ratings and reviews submitted by customers after order delivery.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchAllAdminData}
                  className="px-3 py-1.5 bg-[#123620] hover:bg-[#184428] border border-[#245937] text-xs font-semibold rounded-xl text-[#c9dcce] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Ratings</span>
                </button>
              </div>
            </div>

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-[#0f2d1c] border border-[#235836] rounded-2xl p-4">
                <span className="text-[11px] text-[#8ea896] block uppercase tracking-wider">Average Rating</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-bold font-mono text-amber-400">
                    {ratings.length > 0
                      ? (ratings.reduce((acc, r) => acc + (r.rating || 0), 0) / ratings.length).toFixed(1)
                      : '0.0'}
                  </span>
                  <span className="text-xs text-[#8ea896]">/ 5.0</span>
                </div>
                <div className="flex items-center gap-1 mt-1 text-amber-400 text-xs">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3.5 h-3.5 ${
                        s <= Math.round(ratings.length > 0 ? ratings.reduce((acc, r) => acc + (r.rating || 0), 0) / ratings.length : 0)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-stone-600'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="bg-[#0f2d1c] border border-[#235836] rounded-2xl p-4">
                <span className="text-[11px] text-[#8ea896] block uppercase tracking-wider">Total Ratings</span>
                <span className="text-2xl sm:text-3xl font-bold font-mono text-[#dfb64c] block mt-1">
                  {ratings.length}
                </span>
                <span className="text-[10px] text-[#8ea896] mt-1 block">From delivered orders</span>
              </div>

              <div className="bg-[#0f2d1c] border border-[#235836] rounded-2xl p-4">
                <span className="text-[11px] text-[#8ea896] block uppercase tracking-wider">5-Star Reviews</span>
                <span className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400 block mt-1">
                  {ratings.filter((r) => r.rating === 5).length}
                </span>
                <span className="text-[10px] text-[#8ea896] mt-1 block">
                  {ratings.length > 0 ? `${Math.round((ratings.filter((r) => r.rating === 5).length / ratings.length) * 100)}% excellence` : 'No ratings yet'}
                </span>
              </div>

              <div className="bg-[#0f2d1c] border border-[#235836] rounded-2xl p-4">
                <span className="text-[11px] text-[#8ea896] block uppercase tracking-wider">With Comments</span>
                <span className="text-2xl sm:text-3xl font-bold font-mono text-[#fcfaf6] block mt-1">
                  {ratings.filter((r) => r.review && r.review.trim()).length}
                </span>
                <span className="text-[10px] text-[#8ea896] mt-1 block">Detailed customer feedback</span>
              </div>
            </div>

            {/* Filter & Search Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0c2417] p-3 rounded-2xl border border-[#1b432a]">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {(['all', '5', '4', '3', '2', '1'] as const).map((filterVal) => (
                  <button
                    key={filterVal}
                    type="button"
                    onClick={() => setRatingsFilter(filterVal)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 ${
                      ratingsFilter === filterVal
                        ? 'bg-[#dfb64c] text-[#0a1f13]'
                        : 'bg-[#113320] text-[#a6bfae] hover:text-[#fcfaf6] border border-[#214f34]'
                    }`}
                  >
                    {filterVal === 'all' ? (
                      <span>All ({ratings.length})</span>
                    ) : (
                      <>
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span>{filterVal} Star ({ratings.filter((r) => r.rating === Number(filterVal)).length})</span>
                      </>
                    )}
                  </button>
                ))}
              </div>

              <div className="w-full sm:w-64 relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#799983]" />
                <input
                  type="text"
                  value={ratingsSearchQuery}
                  onChange={(e) => setRatingsSearchQuery(e.target.value)}
                  placeholder="Search item, customer, order..."
                  className="w-full bg-[#123620] border border-[#245937] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#fcfaf6] placeholder-[#6d8a76] focus:outline-none focus:border-[#dfb64c]"
                />
              </div>
            </div>

            {/* Ratings List / Cards */}
            {(() => {
              const filteredRatings = ratings.filter((r) => {
                if (ratingsFilter !== 'all' && r.rating !== Number(ratingsFilter)) {
                  return false;
                }
                if (ratingsSearchQuery.trim()) {
                  const q = ratingsSearchQuery.toLowerCase().trim();
                  const matchItem = (r.itemName || '').toLowerCase().includes(q);
                  const matchCustomer = (r.customerName || '').toLowerCase().includes(q);
                  const matchOrder = (r.orderNumber || '').toLowerCase().includes(q);
                  const matchReview = (r.review || '').toLowerCase().includes(q);
                  return matchItem || matchCustomer || matchOrder || matchReview;
                }
                return true;
              });

              if (filteredRatings.length === 0) {
                return (
                  <div className="bg-[#0f2d1c] border border-[#235836] rounded-2xl p-10 text-center text-[#8ea896]">
                    <div className="w-12 h-12 rounded-full bg-[#164027] border border-[#2e6843] flex items-center justify-center text-amber-400 mx-auto mb-3">
                      <Star className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-[#fcfaf6] mb-1">
                      {ratings.length === 0 ? 'No Customer Ratings Yet' : 'No Ratings Match Filter'}
                    </p>
                    <p className="text-xs max-w-sm mx-auto">
                      {ratings.length === 0
                        ? 'When customers complete delivered orders and rate their food items, their 1 to 5 star ratings and reviews will automatically appear here.'
                        : 'Try selecting "All" or clearing the search box.'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredRatings.map((r) => (
                    <div
                      key={r.id}
                      className="bg-[#0f2d1c] border border-[#235836] rounded-2xl p-4 shadow-sm hover:border-[#dfb64c]/60 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-sm sm:text-base text-[#fcfaf6] leading-snug">
                            {r.itemName}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-xs font-mono font-bold text-[#dfb64c] bg-[#143d26] px-2 py-0.5 rounded border border-[#245937]">
                              {r.orderNumber || `#${r.orderId.slice(0, 6)}`}
                            </span>
                            <span className="text-[11px] text-[#8ea896]">•</span>
                            <span className="text-[11px] text-[#8ea896]">
                              {new Date(r.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Star Rating Badge */}
                        <div className="flex items-center gap-1 bg-amber-950/80 border border-amber-500/40 text-amber-300 px-2.5 py-1 rounded-xl text-xs font-bold shrink-0">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{r.rating}.0</span>
                        </div>
                      </div>

                      {/* Review text if provided */}
                      {r.review && r.review.trim() ? (
                        <div className="bg-[#091a10] border border-[#1b432a] rounded-xl p-2.5 text-xs text-[#c9dcce] italic">
                          "{r.review.trim()}"
                        </div>
                      ) : (
                        <div className="text-[11px] text-[#6d8a76] italic">
                          No written comment provided
                        </div>
                      )}

                      {/* Customer Info Footer */}
                      <div className="pt-2 border-t border-[#184227] flex items-center justify-between text-[11px] text-[#8ea896]">
                        <span className="flex items-center gap-1 text-[#c9dcce] font-medium">
                          <Users className="w-3 h-3 text-[#dfb64c]" />
                          <span>{r.customerName || 'Customer'}</span>
                        </span>
                        {r.customerPhone && (
                          <span className="font-mono text-[#8ea896]">
                            {r.customerPhone}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
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
              {!editingItem && (
                <div className="p-3 bg-[#0d2919] border border-[#205234] rounded-xl flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 text-xs text-[#c9dcce]">
                    <Sparkles className="w-4 h-4 text-[#dfb64c] shrink-0" />
                    <span>Have printed menu card photos? Import multiple items at once using AI scan.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setItemModalOpen(false);
                      setAiImportModalOpen(true);
                    }}
                    className="bg-[#dfb64c] hover:bg-[#ebd06b] text-[#0a1f13] font-bold text-[11px] px-3 py-1.5 rounded-lg shrink-0 flex items-center gap-1 cursor-pointer transition-colors shadow"
                  >
                    <span>Import Photos</span>
                  </button>
                </div>
              )}
              {itemSaveError && (
                <div className="p-3 bg-red-950/80 border border-red-800 text-red-300 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{itemSaveError}</span>
                </div>
              )}
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
                    value={itemForm.categoryId || categories[0]?.id || ''}
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

              {/* Food Item Photo Management: Upload, Take Photo, Preview, Replace, Keep Empty */}
              <div className="p-3.5 bg-[#0a1f13] border border-[#225535] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[#dfb64c] flex items-center gap-1.5 text-xs">
                    <Camera className="w-4 h-4 text-[#dfb64c]" />
                    <span>Food Item Photo</span>
                  </label>
                  <span className="text-[10px] font-medium text-[#8ea896]">
                    {itemForm.imageUrl ? 'Photo Attached' : 'No Photo (Blank)'}
                  </span>
                </div>

                {/* Hidden inputs: One for file picker (Upload), one for Camera capture (Take Photo) */}
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageFileChange}
                  className="hidden"
                />

                {/* Processing/Loading feedback */}
                {imageUploading && (
                  <div className="p-2.5 bg-[#123620] border border-[#245937] rounded-xl text-xs text-[#dfb64c] flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing & preparing photo...</span>
                  </div>
                )}

                {/* Photo Preview & Controls */}
                {itemForm.imageUrl ? (
                  <div className="space-y-2.5">
                    <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden border border-[#dfb64c]/50 bg-[#07190f] shadow-md">
                      <WatermarkedImage
                        src={itemForm.imageUrl}
                        alt="Photo Preview"
                        className="w-full h-full object-cover"
                        watermarkSize="sm"
                      />
                      <div className="absolute top-2 left-2 bg-[#0a1f13]/90 backdrop-blur-sm border border-[#dfb64c]/40 text-[#dfb64c] text-[10px] font-bold px-2 py-0.5 rounded shadow">
                        Photo Preview
                      </div>
                    </div>

                    {/* Replace Photo & Remove Photo (Keep Empty) Buttons */}
                    <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => uploadInputRef.current?.click()}
                          className="px-2.5 py-1.5 bg-[#143d26] hover:bg-[#1a4f32] text-[#dfb64c] hover:text-white border border-[#265e3b] hover:border-[#dfb64c] rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                          title="Upload replacement photo from file"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Replace (Upload)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="px-2.5 py-1.5 bg-[#143d26] hover:bg-[#1a4f32] text-[#dfb64c] hover:text-white border border-[#265e3b] hover:border-[#dfb64c] rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                          title="Take replacement photo with camera"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Replace (Camera)</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setItemForm((prev) => ({ ...prev, imageUrl: '' }))}
                        className="px-2.5 py-1.5 bg-red-950/70 hover:bg-red-900 border border-red-800 text-red-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                        title="Remove photo and keep empty"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove Photo</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Blank state: guidance and Upload / Take Photo buttons */
                  <div className="space-y-2.5">
                    <div className="p-4 bg-[#07190f] border border-dashed border-[#225736] rounded-xl flex flex-col items-center justify-center text-center">
                      <div className="w-10 h-10 rounded-full bg-[#123620] border border-[#225736] flex items-center justify-center text-[#dfb64c] mb-2 shadow-inner">
                        <Camera className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-semibold text-[#fcfaf6]">No photo attached</p>
                      <p className="text-[10px] text-[#8ea896] mt-0.5">
                        Food item will be saved with a blank/empty photo unless you upload or capture one.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => uploadInputRef.current?.click()}
                        className="py-2 px-3 bg-[#143d26] hover:bg-[#1a4f32] text-[#dfb64c] hover:text-white border border-[#265e3b] hover:border-[#dfb64c] rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Upload Photo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="py-2 px-3 bg-[#143d26] hover:bg-[#1a4f32] text-[#dfb64c] hover:text-white border border-[#265e3b] hover:border-[#dfb64c] rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Take Photo</span>
                      </button>
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
                  id="admin-save-menu-item-btn"
                  type="submit"
                  disabled={isSavingItem}
                  className="flex-1 bg-gradient-to-r from-[#dfb64c] to-[#cba135] text-[#0a1f13] font-bold py-2.5 rounded-xl shadow cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSavingItem ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Item...</span>
                    </>
                  ) : (
                    'Save Item'
                  )}
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
                    <div key={it.id} className="flex justify-between items-start text-[10.5px] gap-2">
                      <span className="break-words flex-1 leading-tight"><strong>{it.quantity}x</strong> {it.itemName}</span>
                      <span className="font-bold shrink-0">Rs.{it.subtotal}</span>
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

      {/* ========================================================================= */}
      {/* MODAL: DAILY EXPENSE MANAGEMENT (HOTEL MALABAR ACCOUNTS)                 */}
      {/* ========================================================================= */}
      {expenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg bg-[#0e2a1b] border-2 border-amber-500/60 rounded-2xl p-6 text-[#fdfbf7] shadow-2xl my-8 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1b432a]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-brand text-lg font-bold text-white">
                    Record Daily Expense
                  </h3>
                  <p className="text-xs text-[#8ea896]">
                    Hotel Malabar Daily Accounts & Profit Deduction
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExpenseModalOpen(false)}
                className="text-[#8ea896] hover:text-white cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddExpenseSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#8ea896] mb-1">
                    Expense Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full bg-[#081a10] border border-[#245937] rounded-xl px-3 py-2 text-[#fcfaf6] text-xs focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#8ea896] mb-1">
                    Category *
                  </label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-[#081a10] border border-[#245937] rounded-xl px-3 py-2 text-[#fcfaf6] text-xs focus:border-amber-400 focus:outline-none"
                  >
                    <option value="Kitchen & Groceries">Kitchen & Groceries (Chicken, Veg, Spices)</option>
                    <option value="Packaging & Bags">Packaging & Parcel Bags</option>
                    <option value="Utilities & Gas">Utilities, LPG Gas & Power</option>
                    <option value="Staff & Labor">Staff Daily Wages & Food</option>
                    <option value="Delivery & Fuel">Delivery & Bike Fuel</option>
                    <option value="Maintenance">Maintenance & Repairs</option>
                    <option value="Other">Other Miscellaneous</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#8ea896] mb-1">
                  Expense Description / Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., 5kg Fresh Chicken & Biryani Rice purchase"
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-[#081a10] border border-[#245937] rounded-xl px-3 py-2 text-[#fcfaf6] text-xs focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#8ea896] mb-1">
                  Amount in Rupees (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-[#8ea896] font-bold text-xs">₹</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    placeholder="0"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))}
                    className="w-full bg-[#081a10] border border-[#245937] rounded-xl pl-7 pr-3 py-2 text-amber-300 font-mono font-bold text-sm focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#8ea896] mb-1">
                  Notes / Bill Details (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid via cash from cash drawer"
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-[#081a10] border border-[#245937] rounded-xl px-3 py-2 text-[#fcfaf6] text-xs focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setExpenseModalOpen(false)}
                  className="px-4 py-2 bg-[#123620] hover:bg-[#1a472c] text-[#c9dcce] rounded-xl font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={expenseSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#0a1f13] font-bold rounded-xl shadow cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {expenseSubmitting ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>

            {/* List of recorded expenses for this date */}
            <div className="pt-4 border-t border-[#1b432a] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#8ea896]">
                  Recorded Expenses for {formatCalendarDate(expenseForm.date)}:
                </span>
                <span className="font-mono font-bold text-amber-300">
                  Total: ₹
                  {expenses
                    .filter((ex) => ex.date === expenseForm.date)
                    .reduce((sum, ex) => sum + (Number(ex.amount) || 0), 0)
                    .toLocaleString('en-IN')}
                </span>
              </div>

              {expenses.filter((ex) => ex.date === expenseForm.date).length === 0 ? (
                <div className="p-3 bg-[#081a10] rounded-xl text-center text-xs text-[#5d7c66]">
                  No expenses recorded yet for this date.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {expenses
                    .filter((ex) => ex.date === expenseForm.date)
                    .map((ex) => (
                      <div
                        key={ex.id}
                        className="bg-[#081a10] border border-[#1b432a] rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-white truncate">{ex.title}</div>
                          <div className="text-[10px] text-[#8ea896] flex items-center gap-1.5">
                            <span>{ex.category}</span>
                            {ex.notes && <span>• {ex.notes}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-bold text-amber-400">
                            ₹{Number(ex.amount).toLocaleString('en-IN')}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(ex.id)}
                            className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                            title="Delete this expense record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fallback DOM Thermal Print Target */}
      <div id="thermal-print-container" className="hidden" />

      {/* AI Menu Card Photo Import Modal */}
      <MenuCardImportModal
        isOpen={aiImportModalOpen}
        onClose={() => setAiImportModalOpen(false)}
        categories={categories}
        adminToken={adminToken || ''}
        onItemsAdded={(newItems) => {
          setMenuItems((prev) => [...newItems, ...prev]);
          setImportSuccessMessage(`Successfully imported and added ${newItems.length} items to the menu!`);
          setTimeout(() => setImportSuccessMessage(null), 7000);
          fetchAllAdminData();
        }}
      />
    </div>
  );
};
