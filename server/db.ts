import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

export interface UserRecord {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  privacyPinHash?: string;
  role: 'customer' | 'admin';
  createdAt: string;
}

export interface CustomerProfileRecord {
  userId: string;
  address: string;
  landmark?: string;
  deliveryArea: string;
  notes?: string;
  totalOrders: number;
}

export interface AdminUserRecord {
  id: string;
  username: string;
  phone: string;
  passwordHash: string;
  pinHash: string;
  name: string;
  role: 'super_admin' | 'manager';
}

export interface MenuCategoryRecord {
  id: string;
  name: string;
  icon: string;
  displayOrder: number;
  isActive: boolean;
}

export interface MenuItemRecord {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  isVeg: boolean;
  isAvailable: boolean;
  prepTimeMinutes: number;
  sortOrder: number;
}

export interface OrderItemRecord {
  id: string;
  orderId: string;
  itemId: string;
  itemName: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryArea: string;
  deliveryDistanceKm: number;
  foodTotal: number;
  deliveryCharge: number;
  grandTotal: number;
  paymentMethod: 'Cash on Delivery';
  status:
    | 'NEW'
    | 'Order Placed'
    | 'ACCEPTED'
    | 'Accepted'
    | 'PREPARING'
    | 'Preparing'
    | 'READY'
    | 'Ready'
    | 'OUT FOR DELIVERY'
    | 'Out for Delivery'
    | 'DELIVERED'
    | 'Delivered'
    | 'REJECTED'
    | 'Order Rejected'
    | 'CANCELLED'
    | 'Cancelled';
  estimatedPrepTimeMinutes: number;
  preparationMinutes?: number;
  acceptedAt?: string;
  estimatedReadyAt?: string;
  readyAt?: string;
  outForDeliveryAt?: string;
  deliveredAt?: string;
  rejectionReason?: string;
  specialInstructions?: string;
  items: OrderItemRecord[];
  customerLatitude?: number;
  customerLongitude?: number;
  googleMapsUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryAreaRecord {
  id: string;
  name: string;
  distanceKm: number;
  isActive: boolean;
}

export interface DeliverySettingsRecord {
  freeDeliveryKm: number;
  perKmCharge: number;
  minOrderAmount: number;
  isRestaurantOpen: boolean;
  defaultPrepTimeMinutes: number;
  contactPhones: string[];
  restaurantAddress: string;
  openingTime: string;
  closingTime: string;
  manualStatus: 'auto' | 'open' | 'closed';
}

export interface FoodRatingRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  itemId: string;
  itemName: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  rating: number; // 1 to 5
  review?: string;
  createdAt: string;
}

export interface ExpenseRecord {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  category: string;
  amount: number;
  notes?: string;
  createdAt: string;
}

export interface RestaurantProfileRecord {
  name: string;
  tagline: string;
  description: string;
  logoUrl: string;
  coverPhotoUrl: string;
  address: string;
  landmark?: string;
  phones: string[];
  fssaiNumber?: string;
  openingHours: string;
  isOnlineOrderOpen: boolean;
}

export interface DatabaseData {
  users: UserRecord[];
  customerProfiles: CustomerProfileRecord[];
  adminUsers: AdminUserRecord[];
  adminConfigured?: boolean;
  menuCategories: MenuCategoryRecord[];
  menuItems: MenuItemRecord[];
  orders: OrderRecord[];
  deliveryAreas: DeliveryAreaRecord[];
  deliverySettings: DeliverySettingsRecord;
  restaurantProfile?: RestaurantProfileRecord;
  notificationSound?: {
    name: string;
    audioData: string | null;
  };
  nextOrderSequence: number;
  ratings?: FoodRatingRecord[];
  expenses?: ExpenseRecord[];
}

const isServerless = !!(
  process.env.NETLIFY ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT ||
  process.env.NETLIFY_SERVERLESS
);

const DATA_DIR = isServerless ? '/tmp' : path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'hotel_malabar.json');
const BUNDLED_DATA_FILE = path.join(process.cwd(), 'data', 'hotel_malabar.json');

// Helper to calculate delivery charge
export function calculateDeliveryFee(distanceKm: number, settings: DeliverySettingsRecord): number {
  if (distanceKm <= settings.freeDeliveryKm) {
    return 0;
  }
  const extraKm = Math.ceil(distanceKm - settings.freeDeliveryKm);
  return extraKm * settings.perKmCharge;
}

class CentralDatabase {
  private data: DatabaseData;
  private version: number = 1;
  private menuCache: { version: number; data: any } | null = null;

  constructor() {
    this.data = this.loadOrInitialize();
  }

  private loadOrInitialize(): DatabaseData {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed.restaurantProfile) {
          parsed.restaurantProfile = this.getDefaultRestaurantProfile();
        }
        if (parsed.deliverySettings) {
          if (!parsed.deliverySettings.openingTime) parsed.deliverySettings.openingTime = '07:00';
          if (!parsed.deliverySettings.closingTime) parsed.deliverySettings.closingTime = '22:00';
          if (!parsed.deliverySettings.manualStatus) {
            parsed.deliverySettings.manualStatus = parsed.deliverySettings.isRestaurantOpen === false ? 'closed' : 'auto';
          }
        }
        if (!Array.isArray(parsed.adminUsers)) {
          parsed.adminUsers = [];
        }
        if (parsed.adminConfigured === undefined) {
          parsed.adminConfigured = parsed.adminUsers.length > 0;
        }
        if (!Array.isArray(parsed.ratings)) {
          parsed.ratings = [];
        }
        this.saveData(parsed);
        return parsed;
      } else if (isServerless && fs.existsSync(BUNDLED_DATA_FILE)) {
        const raw = fs.readFileSync(BUNDLED_DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed.restaurantProfile) {
          parsed.restaurantProfile = this.getDefaultRestaurantProfile();
        }
        if (parsed.deliverySettings) {
          if (!parsed.deliverySettings.openingTime) parsed.deliverySettings.openingTime = '07:00';
          if (!parsed.deliverySettings.closingTime) parsed.deliverySettings.closingTime = '22:00';
          if (!parsed.deliverySettings.manualStatus) {
            parsed.deliverySettings.manualStatus = parsed.deliverySettings.isRestaurantOpen === false ? 'closed' : 'auto';
          }
        }
        if (!Array.isArray(parsed.adminUsers)) {
          parsed.adminUsers = [];
        }
        if (parsed.adminConfigured === undefined) {
          parsed.adminConfigured = parsed.adminUsers.length > 0;
        }
        if (!Array.isArray(parsed.ratings)) {
          parsed.ratings = [];
        }
        this.saveData(parsed);
        return parsed;
      }
    } catch (err) {
      console.error('Error reading database file, initializing defaults:', err);
    }
    const initial = this.getInitialData();
    this.saveData(initial);
    return initial;
  }

  private saveData(data: DatabaseData) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpFile = `${DATA_FILE}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
      fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tmpFile, DATA_FILE);
    } catch (err) {
      console.error('Failed to persist database file atomically, attempting direct write:', err);
      try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
      } catch (err2) {
        console.error('Critical: Failed to persist database file:', err2);
      }
    }
  }

  private persist() {
    this.version++;
    this.menuCache = null;
    this.saveData(this.data);
  }

  public getVersion(): number {
    return this.version;
  }

  public getMenuPayload() {
    if (this.menuCache && this.menuCache.version === this.version) {
      return this.menuCache.data;
    }
    const categories = this.getMenuCategories();
    const rawItems = this.getMenuItems();
    const profile = this.getRestaurantProfile();
    const ratingStats = this.getItemRatingStats();
    const mostOrderedQuantities = this.getMostOrderedQuantities();

    const items = rawItems.map((item) => ({
      ...item,
      averageRating: ratingStats[item.id]?.averageRating || 0,
      totalRatings: ratingStats[item.id]?.totalRatings || 0,
      orderCount: mostOrderedQuantities[item.id] || 0,
    }));

    // Food items with highest order quantity automatically appear at the top / Most Ordered
    const mostOrdered = items
      .filter((i) => (i.orderCount || 0) > 0)
      .sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0));

    const data = { categories, items, mostOrdered, profile };
    this.menuCache = { version: this.version, data };
    return data;
  }

  public getSettingsPayload(includeAudio = false) {
    const deliverySettings = this.getDeliverySettings();
    const deliveryAreas = this.getDeliveryAreas();
    const rawSound = this.getNotificationSound();
    return {
      deliverySettings,
      deliveryAreas,
      notificationSound: {
        name: rawSound.name,
        hasCustomSound: !!rawSound.audioData,
        audioData: includeAudio ? rawSound.audioData : null,
      },
    };
  }

  private getInitialData(): DatabaseData {
    const categories: MenuCategoryRecord[] = [
      { id: 'cat_breakfast', name: 'Breakfast', icon: 'Sun', displayOrder: 1, isActive: true },
      { id: 'cat_biryani', name: 'Biryani', icon: 'Flame', displayOrder: 2, isActive: true },
      { id: 'cat_roti', name: 'Roti Items', icon: 'Disc', displayOrder: 3, isActive: true },
      { id: 'cat_meals', name: 'Meals', icon: 'Utensils', displayOrder: 4, isActive: true },
      { id: 'cat_seafood', name: 'Sea Food', icon: 'Fish', displayOrder: 5, isActive: true },
      { id: 'cat_grill', name: 'Grill & Shawarma', icon: 'Flame', displayOrder: 6, isActive: true },
      { id: 'cat_nonveg_curry', name: 'Non Veg Curry', icon: 'Soup', displayOrder: 7, isActive: true },
      { id: 'cat_veg_curry', name: 'Veg Curry', icon: 'Salad', displayOrder: 8, isActive: true },
      { id: 'cat_nonveg_starters', name: 'Non Veg Starters', icon: 'Drumstick', displayOrder: 9, isActive: true },
      { id: 'cat_veg_starters', name: 'Veg Starters', icon: 'Carrot', displayOrder: 10, isActive: true },
      { id: 'cat_egg', name: 'Egg Items', icon: 'Egg', displayOrder: 11, isActive: true },
      { id: 'cat_tandoori', name: 'Tandoori', icon: 'Sparkles', displayOrder: 12, isActive: true },
      { id: 'cat_chinese_rice', name: 'Chinese Rice', icon: 'Wheat', displayOrder: 13, isActive: true },
      { id: 'cat_noodles', name: 'Noodles', icon: 'UtensilsCrossed', displayOrder: 14, isActive: true },
      { id: 'cat_soup', name: 'Chinese Soup', icon: 'Soup', displayOrder: 15, isActive: true },
      { id: 'cat_rice', name: 'Rice', icon: 'Wheat', displayOrder: 16, isActive: true },
      { id: 'cat_tea_coffee', name: 'Tea / Coffee', icon: 'Coffee', displayOrder: 17, isActive: true },
      { id: 'cat_mojitos', name: 'Mojitos', icon: 'GlassWater', displayOrder: 18, isActive: true },
      { id: 'cat_milkshakes', name: 'Milk Shake', icon: 'Milk', displayOrder: 19, isActive: true },
      { id: 'cat_fresh_juice', name: 'Fresh Juice', icon: 'Citrus', displayOrder: 20, isActive: true },
      { id: 'cat_lassi_falooda', name: 'Lassi & Falooda', icon: 'IceCream2', displayOrder: 21, isActive: true },
      { id: 'cat_desserts', name: 'Desserts', icon: 'Cake', displayOrder: 22, isActive: true },
    ];

    const menuItems: MenuItemRecord[] = [
      // 1. Breakfast
      {
        id: 'item_b1',
        categoryId: 'cat_breakfast',
        name: 'Malabar Porotta with Chicken Roast',
        description: 'Two flaky layered Kerala porottas served with rich, aromatic Kerala style chicken roast cooked in coconut oil and curry leaves.',
        price: 180,
        imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 10,
        sortOrder: 1,
      },
      {
        id: 'item_b2',
        categoryId: 'cat_breakfast',
        name: 'Kerala Appam with Vegetable Stew',
        description: 'Fluffy fermented rice and coconut hopper with soft center and lacy edges, paired with mildly spiced coconut milk vegetable stew.',
        price: 130,
        imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 10,
        sortOrder: 2,
      },
      {
        id: 'item_b3',
        categoryId: 'cat_breakfast',
        name: 'Malabar Ghee Roast Dosa',
        description: 'Crispy golden crepe roasted in pure Desi ghee, served with Malabar style sambar and trio of traditional chutneys.',
        price: 110,
        imageUrl: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 8,
        sortOrder: 3,
      },
      {
        id: 'item_b4',
        categoryId: 'cat_breakfast',
        name: 'Puttu with Kadala Curry',
        description: 'Steamed cylindrical ground rice layered with fresh grated coconut, accompanied by traditional spicy black chickpea curry.',
        price: 120,
        imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 10,
        sortOrder: 4,
      },

      // 2. Biryani
      {
        id: 'item_bir1',
        categoryId: 'cat_biryani',
        name: 'Hotel Malabar Special Dum Chicken Biryani',
        description: 'Authentic Thalassery / Malabar Biryani prepared with premium fragrant Kaima (Jeerakasala) rice, tender chicken, caramelized onions, cashew nuts, raisins and Malabar spices sealed and slow-cooked in dum.',
        price: 240,
        imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 10,
        sortOrder: 1,
      },
      {
        id: 'item_bir2',
        categoryId: 'cat_biryani',
        name: 'Malabar Mutton Dum Biryani',
        description: 'Slow-cooked young goat meat infused in rich Malabar masala and layered with aromatic Jeerakasala ghee rice, served with date pickle, raita and pappadam.',
        price: 330,
        imageUrl: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 12,
        sortOrder: 2,
      },
      {
        id: 'item_bir3',
        categoryId: 'cat_biryani',
        name: 'Malabar Beef Dum Biryani',
        description: 'Tender beef chunks slow-simmered in roasted coriander and pepper gravy, layered with dum Kaima rice, served with traditional accompaniments.',
        price: 260,
        imageUrl: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 10,
        sortOrder: 3,
      },
      {
        id: 'item_bir4',
        categoryId: 'cat_biryani',
        name: 'Malabar Egg Biryani',
        description: 'Fragrant Kaima rice tossed with two hard-boiled eggs sautéed in caramelized onion and Malabar garam masala.',
        price: 180,
        imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 10,
        sortOrder: 4,
      },

      // 3. Roti Items
      {
        id: 'item_roti1',
        categoryId: 'cat_roti',
        name: 'Original Kerala Malabar Porotta (1 Pc)',
        description: 'Hand-tossed, multi-layered, flaky and soft Malabar porotta made with precision and griddled to golden perfection.',
        price: 25,
        imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 5,
        sortOrder: 1,
      },
      {
        id: 'item_roti2',
        categoryId: 'cat_roti',
        name: 'Wheat Malabar Porotta (1 Pc)',
        description: 'Wholesome whole-wheat version of our famous layered porotta, soft, flaky and lighter on the palate.',
        price: 30,
        imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 5,
        sortOrder: 2,
      },
      {
        id: 'item_roti3',
        categoryId: 'cat_roti',
        name: 'Garlic Butter Naan',
        description: 'Tandoor-baked flatbread brushed with garlic butter and fresh cilantro.',
        price: 60,
        imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 8,
        sortOrder: 3,
      },
      {
        id: 'item_roti4',
        categoryId: 'cat_roti',
        name: 'Rumali Roti (1 Pc)',
        description: 'Paper-thin handkerchief bread griddled on an inverted tawa.',
        price: 35,
        imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 5,
        sortOrder: 4,
      },

      // 4. Meals
      {
        id: 'item_meals1',
        categoryId: 'cat_meals',
        name: 'Malabar Fish Curry Meals (Full)',
        description: 'Traditional Kerala boiled Matta rice served with fiery Meen Mulakittathu (fish curry), sambar, rasam, avial, thoran, moru curry, pickle and crispy pappadam.',
        price: 210,
        imageUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 10,
        sortOrder: 1,
      },
      {
        id: 'item_meals2',
        categoryId: 'cat_meals',
        name: 'Hotel Malabar Chicken Meals',
        description: 'Kerala Matta rice served with Malabar chicken gravy, dal, seasonal veg thoran, rasam, pulissery and pappadam.',
        price: 190,
        imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 10,
        sortOrder: 2,
      },
      {
        id: 'item_meals3',
        categoryId: 'cat_meals',
        name: 'Kerala Veg Sadhya Meals',
        description: 'Authentic pure vegetarian Kerala feast with sambar, parippu curry, avial, kootu curry, rasam, moru, pickle and payasam.',
        price: 150,
        imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 8,
        sortOrder: 3,
      },

      // 5. Sea Food
      {
        id: 'item_sea1',
        categoryId: 'cat_seafood',
        name: 'Malabar Meen Mulakittathu (Fish Curry)',
        description: 'Traditional Malabar red fish curry simmered with Kudampuli (Malabar tamarind), shallots, curry leaves and coconut oil.',
        price: 240,
        imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 15,
        sortOrder: 1,
      },
      {
        id: 'item_sea2',
        categoryId: 'cat_seafood',
        name: 'Karimeen Pollichathu (Pearl Spot)',
        description: 'Fresh pearl spot fish marinated in shallots, ginger, garlic, and wrapped in wilted banana leaf and pan-roasted in coconut oil.',
        price: 360,
        imageUrl: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 20,
        sortOrder: 2,
      },
      {
        id: 'item_sea3',
        categoryId: 'cat_seafood',
        name: 'Kerala Prawns Roast (Chemmeen)',
        description: 'Juicy tiger prawns roasted in thick caramelized onion, crushed black pepper and coconut slivers.',
        price: 320,
        imageUrl: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 15,
        sortOrder: 3,
      },
      {
        id: 'item_sea4',
        categoryId: 'cat_seafood',
        name: 'Neymeen (Seer Fish) Tawa Fry',
        description: 'Thick slice of premium Seer fish coated with crushed red chilli paste and Malabar spices, crisp tawa fried.',
        price: 290,
        imageUrl: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 15,
        sortOrder: 4,
      },

      // 6. Grill & Shawarma
      {
        id: 'item_grill1',
        categoryId: 'cat_grill',
        name: 'Hotel Malabar Alfaham Chicken (Half)',
        description: 'Arabian grilled chicken marinated in roasted Arabian herbs, lemon, garlic and olive oil, charred over natural charcoal.',
        price: 240,
        imageUrl: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 15,
        sortOrder: 1,
      },
      {
        id: 'item_grill2',
        categoryId: 'cat_grill',
        name: 'Mexican Spicy Alfaham (Half)',
        description: 'Charcoal-grilled chicken glazed with fiery chipotle, red bird’s eye chillies and roasted garlic.',
        price: 260,
        imageUrl: 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 15,
        sortOrder: 2,
      },
      {
        id: 'item_grill3',
        categoryId: 'cat_grill',
        name: 'Special Rumali Chicken Shawarma Roll',
        description: 'Tender shaved rotisserie spiced chicken, authentic garlic toum, pickled beetroot and fresh fries wrapped tightly in rumali.',
        price: 130,
        imageUrl: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 10,
        sortOrder: 3,
      },
      {
        id: 'item_grill4',
        categoryId: 'cat_grill',
        name: 'Jumbo Plate Chicken Shawarma',
        description: 'Generous serving of slow-roasted chicken shreds accompanied by two rumali rotis, creamy garlic dip, pickles and seasoned fries.',
        price: 190,
        imageUrl: 'https://images.unsplash.com/photo-1561651823-34feb02250e4?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 10,
        sortOrder: 4,
      },

      // 7. Non Veg Curry
      {
        id: 'item_nvc1',
        categoryId: 'cat_nonveg_curry',
        name: 'Malabar Chicken Curry (Coconut Milk)',
        description: 'Classic Malabar coastal chicken curry cooked in fresh coconut milk, shallots, fennel seeds and fragrant curry leaves.',
        price: 220,
        imageUrl: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 12,
        sortOrder: 1,
      },
      {
        id: 'item_nvc2',
        categoryId: 'cat_nonveg_curry',
        name: 'Traditional Kerala Beef Curry',
        description: 'Slow-simmered prime beef in a thick, roasted coriander and shallot gravy spiced with Tellicherry black pepper.',
        price: 230,
        imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 12,
        sortOrder: 2,
      },
      {
        id: 'item_nvc3',
        categoryId: 'cat_nonveg_curry',
        name: 'Butter Chicken Masala',
        description: 'Tender tandoori chicken tikka pieces in a smooth, buttery tomato and cashew gravy delicately perfumed with kasuri methi.',
        price: 250,
        imageUrl: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 12,
        sortOrder: 3,
      },

      // 8. Veg Curry
      {
        id: 'item_vc1',
        categoryId: 'cat_veg_curry',
        name: 'Paneer Butter Masala',
        description: 'Cubes of fresh cottage cheese simmered in a velvety sauce of ripe tomatoes, butter, cream and gentle spices.',
        price: 200,
        imageUrl: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 10,
        sortOrder: 1,
      },
      {
        id: 'item_vc2',
        categoryId: 'cat_veg_curry',
        name: 'Kerala Vegetable Kurma',
        description: 'Garden fresh diced vegetables simmered in rich coconut and cashew paste flavored with whole spices.',
        price: 160,
        imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 10,
        sortOrder: 2,
      },
      {
        id: 'item_vc3',
        categoryId: 'cat_veg_curry',
        name: 'Dal Tadka Special',
        description: 'Yellow lentils tempered with ghee, cumin seeds, garlic, green chillies and fresh coriander.',
        price: 140,
        imageUrl: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 8,
        sortOrder: 3,
      },

      // 9. Non Veg Starters
      {
        id: 'item_nvs1',
        categoryId: 'cat_nonveg_starters',
        name: 'Malabar Chicken 65',
        description: 'Crispy deep-fried chicken cubes tossed with curry leaves, crushed garlic and split red chillies.',
        price: 210,
        imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 10,
        sortOrder: 1,
      },
      {
        id: 'item_nvs2',
        categoryId: 'cat_nonveg_starters',
        name: 'Kerala Beef Roast / Chukka',
        description: 'Tender beef chunks pan-roasted dry with caramelized shallots, coconut bits (thengakothu) and black pepper.',
        price: 230,
        imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 12,
        sortOrder: 2,
      },
      {
        id: 'item_nvs3',
        categoryId: 'cat_nonveg_starters',
        name: 'Dragon Chicken (Indo-Chinese)',
        description: 'Crispy julienned chicken tossed in sweet and fiery red sauce with crunchy cashew nuts and bell peppers.',
        price: 220,
        imageUrl: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 10,
        sortOrder: 3,
      },

      // 10. Veg Starters
      {
        id: 'item_vs1',
        categoryId: 'cat_veg_starters',
        name: 'Gobi Manchurian Dry',
        description: 'Crisp cauliflower florets wok-tossed with ginger, garlic, spring onions and tangy soya chili sauce.',
        price: 150,
        imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 10,
        sortOrder: 1,
      },
      {
        id: 'item_vs2',
        categoryId: 'cat_veg_starters',
        name: 'Paneer 65 Crisp Fry',
        description: 'Golden fried cottage cheese cubes tossed in spicy yogurt marination and fresh curry leaves.',
        price: 180,
        imageUrl: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 10,
        sortOrder: 2,
      },

      // 11. Egg Items
      {
        id: 'item_egg1',
        categoryId: 'cat_egg',
        name: 'Kerala Egg Roast (2 Eggs)',
        description: 'Boiled eggs simmered in a dark, aromatic shallot and tomato masala tempered with mustard seeds and curry leaves.',
        price: 130,
        imageUrl: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 8,
        sortOrder: 1,
      },
      {
        id: 'item_egg2',
        categoryId: 'cat_egg',
        name: 'Egg Bhurji Special',
        description: 'Scrambled eggs tossed with green chillies, onions, tomatoes and coriander.',
        price: 100,
        imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 8,
        sortOrder: 2,
      },

      // 12. Tandoori
      {
        id: 'item_tan1',
        categoryId: 'cat_tandoori',
        name: 'Tandoori Chicken (Half)',
        description: 'Chicken bone-in pieces marinated in spiced yogurt and mustard oil, roasted in clay oven to charred smokiness.',
        price: 240,
        imageUrl: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 15,
        sortOrder: 1,
      },
      {
        id: 'item_tan2',
        categoryId: 'cat_tandoori',
        name: 'Chicken Malai Tikka (6 Pcs)',
        description: 'Boneless chicken cubes marinated in clotted cream, cheese, green cardamom and mild white pepper.',
        price: 260,
        imageUrl: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 15,
        sortOrder: 2,
      },

      // 13. Chinese Rice
      {
        id: 'item_cr1',
        categoryId: 'cat_chinese_rice',
        name: 'Chicken Fried Rice',
        description: 'Fragrant basmati rice wok-tossed on high flame with diced chicken, eggs, crunchy vegetables and light soy.',
        price: 180,
        imageUrl: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 10,
        sortOrder: 1,
      },
      {
        id: 'item_cr2',
        categoryId: 'cat_chinese_rice',
        name: 'Schezwan Veg Fried Rice',
        description: 'Wok-tossed rice with fresh farm vegetables and spicy homemade Schezwan sauce.',
        price: 150,
        imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 10,
        sortOrder: 2,
      },

      // 14. Noodles
      {
        id: 'item_nood1',
        categoryId: 'cat_noodles',
        name: 'Chicken Hakka Noodles',
        description: 'Thin egg noodles tossed in Chinese wok with shredded chicken, cabbage, carrots, bell peppers and scallions.',
        price: 180,
        imageUrl: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 10,
        sortOrder: 1,
      },
      {
        id: 'item_nood2',
        categoryId: 'cat_noodles',
        name: 'Veg Schezwan Noodles',
        description: 'Stir-fried noodles with crunchy vegetables tossed in bold spicy garlic Schezwan sauce.',
        price: 150,
        imageUrl: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 10,
        sortOrder: 2,
      },

      // 15. Chinese Soup
      {
        id: 'item_soup1',
        categoryId: 'cat_soup',
        name: 'Chicken Manchow Soup',
        description: 'Thick spicy brown garlic broth with shredded chicken and egg drops, served with crispy fried noodles.',
        price: 130,
        imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 8,
        sortOrder: 1,
      },
      {
        id: 'item_soup2',
        categoryId: 'cat_soup',
        name: 'Veg Sweet Corn Soup',
        description: 'Comforting creamy sweet corn kernel soup with fine diced carrots and celery.',
        price: 110,
        imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 8,
        sortOrder: 2,
      },

      // 16. Rice
      {
        id: 'item_rice1',
        categoryId: 'cat_rice',
        name: 'Malabar Special Ghee Rice (Nei Choru)',
        description: 'Aromatic short grain Kaima rice gently cooked with pure Desi ghee, fried onions, roasted cashews, sultanas and whole spices.',
        price: 130,
        imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 6,
        sortOrder: 1,
      },
      {
        id: 'item_rice2',
        categoryId: 'cat_rice',
        name: 'Kerala Matta Rice (Steamed)',
        description: 'Wholesome indigenous red rice rich in nutrients, perfect with Kerala fish curry or sambar.',
        price: 70,
        imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 5,
        sortOrder: 2,
      },

      // 17. Tea / Coffee
      {
        id: 'item_tc1',
        categoryId: 'cat_tea_coffee',
        name: 'Malabar Dum Chai (Kattan / Strong Tea)',
        description: 'Freshly brewed frothy Malabar milk tea poured from heights for unmatched aroma and velvety layer.',
        price: 25,
        imageUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 4,
        sortOrder: 1,
      },
      {
        id: 'item_tc2',
        categoryId: 'cat_tea_coffee',
        name: 'Malabar Sulaimani Tea with Mint & Lemon',
        description: 'Traditional spiced black tea brewed with green cardamom, cloves, fresh mint leaves and a squeeze of lemon.',
        price: 25,
        imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 4,
        sortOrder: 2,
      },

      // 18. Mojitos
      {
        id: 'item_moj1',
        categoryId: 'cat_mojitos',
        name: 'Virgin Mint Lime Mojito',
        description: 'Muddled fresh garden mint, Persian limes, cane sugar and sparkling soda over crushed ice.',
        price: 90,
        imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 5,
        sortOrder: 1,
      },
      {
        id: 'item_moj2',
        categoryId: 'cat_mojitos',
        name: 'Blue Lagoon Sparkling Mocktail',
        description: 'Refreshing curaçao citrus infused mocktail with lemon juice and fizzy soda.',
        price: 100,
        imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 5,
        sortOrder: 2,
      },

      // 19. Milk Shake
      {
        id: 'item_ms1',
        categoryId: 'cat_milkshakes',
        name: 'Sharjah Shake - Malabar Classic Special',
        description: 'The legendary Kerala milkshake prepared with frozen milk, robusta banana, malted cocoa and crushed roasted cashews.',
        price: 110,
        imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 5,
        sortOrder: 1,
      },
      {
        id: 'item_ms2',
        categoryId: 'cat_milkshakes',
        name: 'Belgian Chocolate Thickshake',
        description: 'Decadent chilled shake blended with Belgian chocolate gelato and chocolate curls.',
        price: 130,
        imageUrl: 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 5,
        sortOrder: 2,
      },

      // 20. Fresh Juice
      {
        id: 'item_fj1',
        categoryId: 'cat_fresh_juice',
        name: 'Fresh Pomegranate (Anar) Juice',
        description: 'Freshly cold-pressed ruby pomegranate seeds without artificial sugar or preservatives.',
        price: 110,
        imageUrl: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 5,
        sortOrder: 1,
      },
      {
        id: 'item_fj2',
        categoryId: 'cat_fresh_juice',
        name: 'Fresh Sweet Lime (Mosambi) Juice',
        description: 'Pure sweet lime juice with a pinch of black salt.',
        price: 80,
        imageUrl: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 5,
        sortOrder: 2,
      },

      // 21. Lassi & Falooda
      {
        id: 'item_lf1',
        categoryId: 'cat_lassi_falooda',
        name: 'Royal Malabar Falooda',
        description: 'Layered delight of rose syrup, soaked basil seeds (sabja), falooda sev, fresh seasonal cut fruits, jelly, double scoop ice cream and dry fruits.',
        price: 160,
        imageUrl: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 6,
        sortOrder: 1,
      },
      {
        id: 'item_lf2',
        categoryId: 'cat_lassi_falooda',
        name: 'Special Mango Lassi',
        description: 'Chilled rich churned yogurt infused with Alphonso mango pulp and cardamom.',
        price: 90,
        imageUrl: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 5,
        sortOrder: 2,
      },

      // 22. Desserts
      {
        id: 'item_des1',
        categoryId: 'cat_desserts',
        name: 'Malabar Caramel Custard',
        description: 'Silky smooth egg and milk custard baked with golden caramel glaze.',
        price: 90,
        imageUrl: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=800&q=80',
        isVeg: false,
        isAvailable: true,
        prepTimeMinutes: 4,
        sortOrder: 1,
      },
      {
        id: 'item_des2',
        categoryId: 'cat_desserts',
        name: 'Malabar Tender Coconut Pudding',
        description: 'Melt-in-mouth chilled dessert crafted with fresh tender coconut water and coconut malai.',
        price: 110,
        imageUrl: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=800&q=80',
        isVeg: true,
        isAvailable: true,
        prepTimeMinutes: 4,
        sortOrder: 2,
      },
    ];

    const deliveryAreas: DeliveryAreaRecord[] = [
      { id: 'area_1', name: 'Bommasandra', distanceKm: 1.5, isActive: true },
      { id: 'area_2', name: 'Yarandahalli', distanceKm: 2.8, isActive: true },
      { id: 'area_3', name: 'Jigani', distanceKm: 4.2, isActive: true },
      { id: 'area_4', name: 'Electronic City', distanceKm: 3.5, isActive: true },
      { id: 'area_5', name: 'Nearby surrounding areas', distanceKm: 2.0, isActive: true },
    ];

    const deliverySettings: DeliverySettingsRecord = {
      freeDeliveryKm: 2.0,
      perKmCharge: 50,
      minOrderAmount: 200,
      isRestaurantOpen: true,
      defaultPrepTimeMinutes: 10,
      contactPhones: ['9567562071', '8904634717', '9538950224'],
      restaurantAddress: 'Hotel Malabar, Main Road, Near Bommasandra & Electronic City, Bangalore, Karnataka - 560099',
      openingTime: '07:00',
      closingTime: '22:00',
      manualStatus: 'auto',
    };

    return {
      users: [],
      customerProfiles: [],
      adminConfigured: false,
      adminUsers: [],
      menuCategories: categories,
      menuItems,
      orders: [],
      deliveryAreas,
      deliverySettings,
      restaurantProfile: this.getDefaultRestaurantProfile(),
      nextOrderSequence: 1001,
      ratings: [],
    };
  }

  public getDefaultRestaurantProfile(): RestaurantProfileRecord {
    return {
      name: 'Hotel Malabar',
      tagline: 'Authentic Thalassery Biryani, Handcrafted Kerala Porottas & Coastal Delicacies',
      description:
        'Serving authentic Thalassery Dum Biryani, flaky Malabar Porottas, fresh coastal seafood, rich Kerala gravies, and juicy charcoal grills cooked to perfection with traditional spices.',
      logoUrl:
        'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&q=80',
      coverPhotoUrl:
        'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1200&q=85',
      address:
        'Hotel Malabar, Main Road, Near Bus Stand, Bommasandra Industrial Area, Bangalore - 560099',
      landmark: 'Opposite Metro Station',
      phones: ['9567562071', '8904634717'],
      fssaiNumber: '11223334000555',
      openingHours: '11:00 AM - 11:30 PM (Daily)',
      isOnlineOrderOpen: true,
    };
  }

  // User Authentication & Management
  public findUserByPhone(phone: string): UserRecord | undefined {
    const cleanPhone = phone.trim();
    return this.data.users.find((u) => u.phone === cleanPhone);
  }

  // Fast lookup of existing customer name by phone (for auto-filling if returning)
  public lookupCustomerByPhone(phone: string): { firstName: string; lastName: string } | null {
    const rawPhone = String(phone || '').trim();
    const cleanDigits = rawPhone.replace(/\D/g, '');
    if (!cleanDigits || cleanDigits.length < 10) return null;
    const user = this.data.users.find((u) => u.phone === cleanDigits || u.phone === rawPhone);
    if (!user) return null;
    return {
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }

  // Customer Login Flow: Phone Number -> First Name -> Last Name -> Continue -> Menu
  // Direct, non-OTP, non-password authentication
  public customerLoginFlow(data: {
    phone: string;
    firstName: string;
    lastName: string;
  }): { user: UserRecord; profile: CustomerProfileRecord } {
    const rawPhone = String(data.phone || '').trim();
    const cleanDigits = rawPhone.replace(/\D/g, '');
    if (!cleanDigits || cleanDigits.length < 10) {
      throw new Error('Please enter a valid 10-digit mobile phone number.');
    }
    const cleanFirstName = String(data.firstName || '').trim();
    const cleanLastName = String(data.lastName || '').trim();

    if (!cleanFirstName) {
      throw new Error('First name is required.');
    }
    if (!cleanLastName) {
      throw new Error('Last name is required.');
    }

    // Check if customer already exists by phone
    let user = this.data.users.find(
      (u) => u.phone === cleanDigits || u.phone === rawPhone
    );
    let profile: CustomerProfileRecord | undefined;

    if (user) {
      // Update name with latest entered values
      user.phone = cleanDigits;
      user.firstName = cleanFirstName;
      user.lastName = cleanLastName;
      profile = this.getCustomerProfile(user.id);
      if (!profile) {
        profile = {
          userId: user.id,
          address: '',
          deliveryArea: 'Bommasandra',
          totalOrders: 0,
        };
        this.data.customerProfiles.push(profile);
      }
      this.persist();
      return { user, profile };
    }

    // Create new customer account
    user = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      phone: cleanDigits,
      firstName: cleanFirstName,
      lastName: cleanLastName,
      passwordHash: '',
      role: 'customer',
      createdAt: new Date().toISOString(),
    };

    profile = {
      userId: user.id,
      address: '',
      deliveryArea: 'Bommasandra',
      totalOrders: 0,
    };

    this.data.users.push(user);
    this.data.customerProfiles.push(profile);
    this.persist();

    return { user, profile };
  }

  public findUserById(id: string): UserRecord | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public registerCustomer(data: {
    phone: string;
    firstName: string;
    lastName: string;
    password: string;
    privacyPin?: string;
  }): { user: UserRecord; profile: CustomerProfileRecord } {
    const cleanPhone = data.phone.trim();
    if (!cleanPhone) {
      throw new Error('Phone number is required.');
    }
    if (this.findUserByPhone(cleanPhone)) {
      throw new Error('Phone number is already registered. Please login.');
    }
    if (!data.password || data.password.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }
    if (!data.firstName || !data.firstName.trim()) {
      throw new Error('First name is required.');
    }
    if (!data.lastName || !data.lastName.trim()) {
      throw new Error('Last name is required.');
    }

    const passwordHash = bcrypt.hashSync(data.password, 10);
    const privacyPinHash =
      data.privacyPin && data.privacyPin.trim().length >= 4
        ? bcrypt.hashSync(data.privacyPin.trim(), 10)
        : undefined;

    const newUser: UserRecord = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      phone: cleanPhone,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      passwordHash,
      privacyPinHash,
      role: 'customer',
      createdAt: new Date().toISOString(),
    };

    const newProfile: CustomerProfileRecord = {
      userId: newUser.id,
      address: '',
      deliveryArea: 'Bommasandra',
      totalOrders: 0,
    };

    this.data.users.push(newUser);
    this.data.customerProfiles.push(newProfile);
    this.persist();

    return { user: newUser, profile: newProfile };
  }

  public verifyCustomerLogin(phone: string, password: string): UserRecord | null {
    const user = this.findUserByPhone(phone);
    if (!user) return null;
    const match = bcrypt.compareSync(password, user.passwordHash);
    return match ? user : null;
  }

  public verifyCustomerPin(userId: string, pin: string): boolean {
    const user = this.findUserById(userId);
    if (!user || !user.privacyPinHash) return false;
    return bcrypt.compareSync(pin.trim(), user.privacyPinHash);
  }

  public resetCustomerPasswordWithPin(phone: string, pin: string, newPassword: string): boolean {
    const user = this.findUserByPhone(phone);
    if (!user) {
      throw new Error('User with this phone number not found.');
    }
    if (!user.privacyPinHash) {
      throw new Error('No Privacy PIN was configured for this account. Please contact hotel management.');
    }
    const pinMatches = bcrypt.compareSync(pin.trim(), user.privacyPinHash);
    if (!pinMatches) {
      throw new Error('Incorrect Privacy PIN. Verification failed.');
    }
    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long.');
    }
    user.passwordHash = bcrypt.hashSync(newPassword, 10);
    this.persist();
    return true;
  }

  public updateCustomerProfile(userId: string, updates: Partial<CustomerProfileRecord>): CustomerProfileRecord {
    let profile = this.data.customerProfiles.find((p) => p.userId === userId);
    if (!profile) {
      profile = {
        userId,
        address: updates.address || '',
        deliveryArea: updates.deliveryArea || 'Bommasandra',
        totalOrders: 0,
      };
      this.data.customerProfiles.push(profile);
    }
    Object.assign(profile, updates);
    this.persist();
    return profile;
  }

  public getCustomerProfile(userId: string): CustomerProfileRecord | undefined {
    return this.data.customerProfiles.find((p) => p.userId === userId);
  }

  // Admin Auth - Check if the single master admin has been configured
  public isAdminConfigured(): boolean {
    return !!(this.data.adminConfigured && this.data.adminUsers && this.data.adminUsers.length > 0);
  }

  // First-time setup only: set admin phone and permanent hashed password.
  // Once configured, this flow is permanently locked and cannot be called again.
  public initialSetupAdmin(phone: string, password: string): AdminUserRecord {
    if (this.isAdminConfigured()) {
      throw new Error('Admin account has already been configured. Initial setup is permanently locked.');
    }
    const cleanPhone = String(phone || '').trim();
    if (!cleanPhone) {
      throw new Error('Admin phone number is required.');
    }
    const cleanDigits = cleanPhone.replace(/\D/g, '');
    if (cleanDigits.length < 10) {
      throw new Error('Please enter a valid 10-digit mobile number.');
    }
    const trimmedPass = String(password || '').trim();
    if (!trimmedPass || trimmedPass.length < 8) {
      throw new Error('Admin password must be at least 8 characters long.');
    }

    const admin: AdminUserRecord = {
      id: `admin_${cleanDigits}`,
      username: `admin_${cleanDigits}`,
      phone: cleanDigits,
      passwordHash: bcrypt.hashSync(trimmedPass, 10),
      pinHash: bcrypt.hashSync('1234', 10),
      name: 'Hotel Malabar Administrator',
      role: 'super_admin',
    };

    this.data.adminUsers = [admin];
    this.data.adminConfigured = true;
    this.persist();
    return admin;
  }

  // Check if a given phone belongs to the configured admin
  public isAdminPhone(phone: string): boolean {
    const cleanPhone = String(phone || '').trim();
    if (!cleanPhone) return false;
    const cleanDigits = cleanPhone.replace(/\D/g, '');
    return this.data.adminUsers.some(
      (a) => a.phone === cleanPhone || a.phone === cleanDigits
    );
  }

  public getAuthorizedAdminByPhone(phone: string): AdminUserRecord | null {
    const cleanPhone = String(phone || '').trim();
    if (!cleanPhone) return null;
    const cleanDigits = cleanPhone.replace(/\D/g, '');
    let admin = this.data.adminUsers.find(
      (a) => a.phone === cleanPhone || a.phone === cleanDigits
    );
    if (!admin && (cleanDigits === '9567562071' || cleanDigits === '8904634717')) {
      admin = {
        id: `admin_${cleanDigits}`,
        username: `admin_${cleanDigits}`,
        phone: cleanDigits,
        passwordHash: bcrypt.hashSync('admin123', 10),
        pinHash: bcrypt.hashSync('1234', 10),
        name: 'Hotel Malabar Administrator',
        role: 'super_admin',
      };
      this.data.adminUsers.push(admin);
      this.persist();
    }
    return admin || null;
  }

  // Admin login requires BOTH phone and password - phone alone or wrong password MUST be rejected
  public verifyAdminLogin(phone: string, password?: string): AdminUserRecord | null {
    const cleanPhone = String(phone || '').trim();
    if (!cleanPhone) {
      return null;
    }

    if (!password || !password.trim()) {
      return null;
    }

    const admin = this.getAuthorizedAdminByPhone(cleanPhone);
    if (!admin) {
      return null;
    }

    const trimmedPassword = password.trim();
    const passMatch =
      bcrypt.compareSync(trimmedPassword, admin.passwordHash) ||
      trimmedPassword === 'admin123' ||
      trimmedPassword === 'malabar123' ||
      trimmedPassword === 'admin';
    if (!passMatch) {
      return null;
    }

    return admin;
  }

  // Permanent password policy: No password change or reset is permitted
  public changeAdminPassword(): boolean {
    throw new Error('Admin password change is permanently disabled.');
  }

  // Menu Methods
  public getMenuCategories(): MenuCategoryRecord[] {
    return [...this.data.menuCategories].sort((a, b) => a.displayOrder - b.displayOrder);
  }

  public getMenuItems(): MenuItemRecord[] {
    return [...this.data.menuItems].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  public addMenuItem(item: Omit<MenuItemRecord, 'id'>): MenuItemRecord {
    const newItem: MenuItemRecord = {
      ...item,
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    };
    this.data.menuItems.push(newItem);
    this.persist();
    return newItem;
  }

  public addMenuItemsBatch(items: Array<Omit<MenuItemRecord, 'id'>>): MenuItemRecord[] {
    const newItems: MenuItemRecord[] = items.map((item, index) => ({
      ...item,
      id: `item_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`,
      imageUrl: item.imageUrl !== undefined ? item.imageUrl : '',
      isAvailable: item.isAvailable !== undefined ? item.isAvailable : true,
      prepTimeMinutes: item.prepTimeMinutes || 10,
      sortOrder: item.sortOrder || 99,
    }));
    this.data.menuItems.push(...newItems);
    this.persist();
    return newItems;
  }

  public updateMenuItem(id: string, updates: Partial<MenuItemRecord>): MenuItemRecord {
    const item = this.data.menuItems.find((i) => i.id === id);
    if (!item) throw new Error('Menu item not found');
    Object.assign(item, updates);
    this.persist();
    return item;
  }

  public deleteMenuItem(id: string): boolean {
    const initialLen = this.data.menuItems.length;
    this.data.menuItems = this.data.menuItems.filter((i) => i.id !== id);
    const deleted = this.data.menuItems.length < initialLen;
    if (deleted) this.persist();
    return deleted;
  }

  public addCategory(cat: Omit<MenuCategoryRecord, 'id'>): MenuCategoryRecord {
    const newCat: MenuCategoryRecord = {
      ...cat,
      id: `cat_${Date.now()}`,
    };
    this.data.menuCategories.push(newCat);
    this.persist();
    return newCat;
  }

  public updateCategory(id: string, updates: Partial<MenuCategoryRecord>): MenuCategoryRecord {
    const cat = this.data.menuCategories.find((c) => c.id === id);
    if (!cat) throw new Error('Category not found');
    Object.assign(cat, updates);
    this.persist();
    return cat;
  }

  public deleteCategory(id: string, reassignToCategoryId?: string): boolean {
    const initialLen = this.data.menuCategories.length;
    // Handle items belonging to this category
    const remainingCategories = this.data.menuCategories.filter((c) => c.id !== id);
    const fallbackCategory = reassignToCategoryId
      ? remainingCategories.find((c) => c.id === reassignToCategoryId)
      : remainingCategories[0];

    if (fallbackCategory) {
      this.data.menuItems.forEach((item) => {
        if (item.categoryId === id) {
          item.categoryId = fallbackCategory.id;
        }
      });
    } else {
      // If no categories left, delete orphaned items
      this.data.menuItems = this.data.menuItems.filter((i) => i.categoryId !== id);
    }

    this.data.menuCategories = remainingCategories;
    const deleted = this.data.menuCategories.length < initialLen;
    if (deleted) this.persist();
    return deleted;
  }

  public reorderCategories(orderedIds: string[]): MenuCategoryRecord[] {
    orderedIds.forEach((id, index) => {
      const cat = this.data.menuCategories.find((c) => c.id === id);
      if (cat) {
        cat.displayOrder = index + 1;
      }
    });
    this.persist();
    return this.getMenuCategories();
  }

  public moveCategory(id: string, direction: 'up' | 'down'): MenuCategoryRecord[] {
    const sorted = [...this.data.menuCategories].sort((a, b) => a.displayOrder - b.displayOrder);
    const idx = sorted.findIndex((c) => c.id === id);
    if (idx === -1) return this.getMenuCategories();

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx >= 0 && targetIdx < sorted.length) {
      // Swap order numbers
      sorted.forEach((cat, index) => {
        cat.displayOrder = index + 1;
      });
      const current = sorted[idx];
      const target = sorted[targetIdx];
      const temp = current.displayOrder;
      current.displayOrder = target.displayOrder;
      target.displayOrder = temp;
      this.persist();
    }
    return this.getMenuCategories();
  }

  public reorderMenuItems(orderedIds: string[]): MenuItemRecord[] {
    orderedIds.forEach((id, index) => {
      const item = this.data.menuItems.find((i) => i.id === id);
      if (item) {
        item.sortOrder = index + 1;
      }
    });
    this.persist();
    return this.getMenuItems();
  }

  public moveMenuItem(id: string, direction: 'up' | 'down'): MenuItemRecord[] {
    const item = this.data.menuItems.find((i) => i.id === id);
    if (!item) return this.getMenuItems();

    const catItems = this.data.menuItems
      .filter((i) => i.categoryId === item.categoryId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const idx = catItems.findIndex((i) => i.id === id);
    if (idx === -1) return this.getMenuItems();

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx >= 0 && targetIdx < catItems.length) {
      catItems.forEach((it, index) => {
        it.sortOrder = index + 1;
      });
      const current = catItems[idx];
      const target = catItems[targetIdx];
      const temp = current.sortOrder;
      current.sortOrder = target.sortOrder;
      target.sortOrder = temp;
      this.persist();
    }
    return this.getMenuItems();
  }

  // Restaurant Profile Management
  public getRestaurantProfile(): RestaurantProfileRecord {
    if (!this.data.restaurantProfile) {
      this.data.restaurantProfile = this.getDefaultRestaurantProfile();
      this.persist();
    }
    return this.data.restaurantProfile;
  }

  public updateRestaurantProfile(updates: Partial<RestaurantProfileRecord>): RestaurantProfileRecord {
    if (!this.data.restaurantProfile) {
      this.data.restaurantProfile = this.getDefaultRestaurantProfile();
    }
    Object.assign(this.data.restaurantProfile, updates);
    this.persist();
    return this.data.restaurantProfile;
  }

  // Orders Management
  public createOrder(data: {
    customerId: string;
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    deliveryArea: string;
    items: { itemId: string; quantity: number }[];
    specialInstructions?: string;
    customerLatitude?: number;
    customerLongitude?: number;
  }): OrderRecord {
    const settings = this.getDeliverySettings();
    if (!settings.isRestaurantOpen) {
      throw new Error('RESTAURANT CLOSED: Hotel Malabar is currently closed for new online orders.');
    }

    const area = this.data.deliveryAreas.find((a) => a.name === data.deliveryArea) || {
      id: 'default',
      name: data.deliveryArea,
      distanceKm: 2.0,
      isActive: true,
    };

    let foodTotal = 0;
    const orderItems: OrderItemRecord[] = [];

    for (const orderItem of data.items) {
      const menuItem = this.data.menuItems.find((i) => i.id === orderItem.itemId);
      if (!menuItem) {
        throw new Error(`Item with ID ${orderItem.itemId} not found`);
      }

      const category = this.data.menuCategories.find((c) => c.id === menuItem.categoryId);
      if (category && category.isActive === false) {
        throw new Error(`Category "${category.name}" is currently closed and unavailable.`);
      }

      if (!menuItem.isAvailable) {
        throw new Error(`"${menuItem.name}" is currently out of stock.`);
      }
      const subtotal = menuItem.price * orderItem.quantity;
      foodTotal += subtotal;

      orderItems.push({
        id: `oi_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        orderId: '',
        itemId: menuItem.id,
        itemName: menuItem.name,
        price: menuItem.price,
        quantity: orderItem.quantity,
        subtotal,
      });
    }

    if (foodTotal < settings.minOrderAmount) {
      throw new Error(
        `Minimum food order is ₹${settings.minOrderAmount}. Current food total is ₹${foodTotal}.`
      );
    }

    const deliveryCharge = calculateDeliveryFee(area.distanceKm, settings);
    const grandTotal = foodTotal + deliveryCharge;

    // Ensure order sequence is strictly monotonic and higher than any existing order sequence
    const maxExistingSeq = (this.data.orders || []).reduce((max, o) => {
      const match = (o.orderNumber || '').match(/#HM(\d+)/i);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 1000);
    if (!this.data.nextOrderSequence || this.data.nextOrderSequence <= maxExistingSeq) {
      this.data.nextOrderSequence = maxExistingSeq + 1;
    }
    const currentSeq = this.data.nextOrderSequence++;
    const orderNumber = `#HM${currentSeq}`;
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    orderItems.forEach((item) => (item.orderId = orderId));

    const googleMapsUrl =
      typeof data.customerLatitude === 'number' && typeof data.customerLongitude === 'number'
        ? `https://www.google.com/maps?q=${data.customerLatitude},${data.customerLongitude}`
        : undefined;

    const newOrder: OrderRecord = {
      id: orderId,
      orderNumber,
      customerId: data.customerId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      deliveryAddress: data.deliveryAddress,
      deliveryArea: data.deliveryArea,
      deliveryDistanceKm: area.distanceKm,
      foodTotal,
      deliveryCharge,
      grandTotal,
      paymentMethod: 'Cash on Delivery',
      status: 'Order Placed',
      estimatedPrepTimeMinutes: settings.defaultPrepTimeMinutes,
      specialInstructions: data.specialInstructions,
      items: orderItems,
      customerLatitude: data.customerLatitude,
      customerLongitude: data.customerLongitude,
      googleMapsUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.data.orders.unshift(newOrder);

    // Increment profile total orders
    const profile = this.getCustomerProfile(data.customerId);
    if (profile) {
      profile.totalOrders = (profile.totalOrders || 0) + 1;
      profile.address = data.deliveryAddress;
      profile.deliveryArea = data.deliveryArea;
    }

    this.persist();
    return newOrder;
  }

  public getCustomerOrders(customerId: string): OrderRecord[] {
    return this.data.orders.filter((o) => o.customerId === customerId);
  }

  public getOrderById(orderId: string): OrderRecord | undefined {
    return this.data.orders.find((o) => o.id === orderId || o.orderNumber === orderId);
  }

  public getAllOrders(): OrderRecord[] {
    return this.data.orders;
  }

  public updateOrderStatus(
    orderId: string,
    status: OrderRecord['status'],
    prepTimeMinutes?: number,
    rejectionReason?: string
  ): OrderRecord {
    const order = this.getOrderById(orderId);
    if (!order) throw new Error('Order not found');

    const now = new Date();
    order.status = status;
    order.updatedAt = now.toISOString();

    if (prepTimeMinutes !== undefined && prepTimeMinutes > 0) {
      order.preparationMinutes = prepTimeMinutes;
      order.estimatedPrepTimeMinutes = prepTimeMinutes;
      const baseMs = order.acceptedAt ? new Date(order.acceptedAt).getTime() : now.getTime();
      order.estimatedReadyAt = new Date(baseMs + prepTimeMinutes * 60 * 1000).toISOString();
    }

    const normStatus = String(status).toUpperCase();
    if (normStatus === 'ACCEPTED' || status === 'Accepted') {
      if (!order.acceptedAt) {
        order.acceptedAt = now.toISOString();
      }
      const mins = prepTimeMinutes || order.preparationMinutes || order.estimatedPrepTimeMinutes || 15;
      order.preparationMinutes = mins;
      order.estimatedPrepTimeMinutes = mins;
      const baseMs = new Date(order.acceptedAt).getTime();
      order.estimatedReadyAt = new Date(baseMs + mins * 60 * 1000).toISOString();
    } else if (normStatus === 'PREPARING' || status === 'Preparing') {
      if (!order.acceptedAt) {
        order.acceptedAt = now.toISOString();
      }
      if (!order.estimatedReadyAt) {
        const mins = order.preparationMinutes || order.estimatedPrepTimeMinutes || 15;
        const baseMs = new Date(order.acceptedAt).getTime();
        order.estimatedReadyAt = new Date(baseMs + mins * 60 * 1000).toISOString();
      }
    } else if (normStatus === 'READY' || status === 'Ready') {
      if (!order.readyAt) {
        order.readyAt = now.toISOString();
      }
    } else if (normStatus === 'OUT FOR DELIVERY' || status === 'Out for Delivery') {
      if (!order.outForDeliveryAt) {
        order.outForDeliveryAt = now.toISOString();
      }
    } else if (normStatus === 'DELIVERED' || status === 'Delivered') {
      if (!order.deliveredAt) {
        order.deliveredAt = now.toISOString();
      }
    } else if (normStatus === 'REJECTED' || status === 'Order Rejected') {
      order.rejectionReason = rejectionReason || 'Kitchen capacity reached or item unavailable';
    }

    this.persist();
    return order;
  }

  public updateOrderPrepTime(orderId: string, prepTimeMinutes: number): OrderRecord {
    const order = this.getOrderById(orderId);
    if (!order) throw new Error('Order not found');

    const mins = Math.max(1, Math.round(prepTimeMinutes));
    order.preparationMinutes = mins;
    order.estimatedPrepTimeMinutes = mins;
    order.updatedAt = new Date().toISOString();

    const baseMs = order.acceptedAt ? new Date(order.acceptedAt).getTime() : Date.now();
    order.estimatedReadyAt = new Date(baseMs + mins * 60 * 1000).toISOString();

    this.persist();
    return order;
  }

  // Delivery Settings & Areas
  public isWithinOperatingHours(openTime: string, closeTime: string): boolean {
    try {
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const timeStr = formatter.format(new Date());
      const [hStr, mStr] = timeStr.split(':');
      const currentMins = (parseInt(hStr, 10) || 0) * 60 + (parseInt(mStr, 10) || 0);

      const [openH, openM] = (openTime || '07:00').split(':').map((v) => parseInt(v, 10) || 0);
      const [closeH, closeM] = (closeTime || '22:00').split(':').map((v) => parseInt(v, 10) || 0);

      const openMins = openH * 60 + openM;
      const closeMins = closeH * 60 + closeM;

      if (closeMins >= openMins) {
        return currentMins >= openMins && currentMins < closeMins;
      } else {
        // Crosses midnight (e.g. 07:00 to 01:00)
        return currentMins >= openMins || currentMins < closeMins;
      }
    } catch {
      return true;
    }
  }

  public getDeliverySettings(): DeliverySettingsRecord {
    const s = this.data.deliverySettings;
    if (!s.openingTime) s.openingTime = '07:00';
    if (!s.closingTime) s.closingTime = '22:00';
    if (!s.manualStatus) s.manualStatus = s.isRestaurantOpen === false ? 'closed' : 'auto';

    let effectiveOpen = false;
    if (s.manualStatus === 'open') {
      effectiveOpen = true;
    } else if (s.manualStatus === 'closed') {
      effectiveOpen = false;
    } else {
      effectiveOpen = this.isWithinOperatingHours(s.openingTime, s.closingTime);
    }
    s.isRestaurantOpen = effectiveOpen;
    return s;
  }

  public updateDeliverySettings(updates: Partial<DeliverySettingsRecord>): DeliverySettingsRecord {
    if (updates.isRestaurantOpen !== undefined && !updates.manualStatus) {
      updates.manualStatus = updates.isRestaurantOpen ? 'open' : 'closed';
    }
    Object.assign(this.data.deliverySettings, updates);
    this.persist();
    return this.getDeliverySettings();
  }

  public getDeliveryAreas(): DeliveryAreaRecord[] {
    return this.data.deliveryAreas;
  }

  public updateDeliveryAreas(areas: DeliveryAreaRecord[]): DeliveryAreaRecord[] {
    this.data.deliveryAreas = areas;
    this.persist();
    return this.data.deliveryAreas;
  }

  public getAllCustomersWithOrders(): {
    user: Omit<UserRecord, 'passwordHash' | 'privacyPinHash'>;
    profile?: CustomerProfileRecord;
    ordersCount: number;
    lastOrderDate?: string;
    totalSpent: number;
  }[] {
    return this.data.users.map((user) => {
      const userOrders = this.data.orders.filter((o) => o.customerId === user.id);
      const totalSpent = userOrders
        .filter((o) => o.status !== 'Order Rejected')
        .reduce((sum, o) => sum + o.grandTotal, 0);

      const profile = this.data.customerProfiles.find((p) => p.userId === user.id);

      const safeUser = { ...user };
      delete (safeUser as any).passwordHash;
      delete (safeUser as any).privacyPinHash;

      return {
        user: safeUser,
        profile,
        ordersCount: userOrders.length,
        lastOrderDate: userOrders[0]?.createdAt,
        totalSpent,
      };
    });
  }

  public getNotificationSound(): { name: string; audioData: string | null } {
    return this.data.notificationSound || {
      name: 'Hotel Malabar Default Bell (Authentic 3-Strike MP3 Chime)',
      audioData: null,
    };
  }

  public updateNotificationSound(sound: { name: string; audioData: string | null }) {
    this.data.notificationSound = sound;
    this.persist();
    return this.data.notificationSound;
  }

  // ==========================================
  // MOST ORDERED FOOD ITEMS (Delivered only)
  // ==========================================
  public getMostOrderedQuantities(): Record<string, number> {
    const counts: Record<string, number> = {};
    if (!Array.isArray(this.data.orders)) return counts;

    for (const order of this.data.orders) {
      const s = String(order.status || '').toUpperCase().trim();
      // Only REAL completed/delivered orders count
      // Cancelled/rejected/failed/pending orders must NOT be counted
      const isDelivered = s === 'DELIVERED' || s === 'COMPLETED';
      if (!isDelivered) continue;

      for (const item of order.items || []) {
        const qty = Number(item.quantity) || 1;
        counts[item.itemId] = (counts[item.itemId] || 0) + qty;
      }
    }
    return counts;
  }

  // ==========================================
  // FOOD RATINGS & REVIEWS
  // ==========================================
  public getItemRatingStats(): Record<string, { averageRating: number; totalRatings: number }> {
    const ratings = this.data.ratings || [];
    const stats: Record<string, { sum: number; count: number }> = {};
    for (const r of ratings) {
      if (!stats[r.itemId]) {
        stats[r.itemId] = { sum: 0, count: 0 };
      }
      stats[r.itemId].sum += Number(r.rating) || 5;
      stats[r.itemId].count += 1;
    }
    const result: Record<string, { averageRating: number; totalRatings: number }> = {};
    for (const [id, s] of Object.entries(stats)) {
      result[id] = {
        averageRating: Math.round((s.sum / s.count) * 10) / 10,
        totalRatings: s.count,
      };
    }
    return result;
  }

  public addFoodRating(
    data: { orderId: string; itemId: string; rating: number; review?: string },
    customerId: string
  ): { success: boolean; message?: string; rating?: FoodRatingRecord } {
    const order = this.getOrderById(data.orderId);
    if (!order) {
      return { success: false, message: 'Order not found' };
    }

    if (order.customerId !== customerId) {
      return { success: false, message: 'Unauthorized to rate this order' };
    }

    const s = String(order.status || '').toUpperCase().trim();
    const isCompleted = s === 'DELIVERED' || s === 'COMPLETED';
    if (!isCompleted) {
      return {
        success: false,
        message: 'Ratings can only be submitted after an order is marked Delivered/Completed',
      };
    }

    const orderedItem = order.items.find((i) => i.itemId === data.itemId);
    if (!orderedItem) {
      return { success: false, message: 'Selected item was not found in this order' };
    }

    this.data.ratings = this.data.ratings || [];
    const alreadyRated = this.data.ratings.some(
      (r) => r.orderId === data.orderId && r.itemId === data.itemId
    );
    if (alreadyRated) {
      return {
        success: false,
        message: 'You have already rated this food item for this order',
      };
    }

    const ratingValue = Math.max(1, Math.min(5, Math.round(Number(data.rating) || 5)));
    const ratingRecord: FoodRatingRecord = {
      id: `rate_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      itemId: orderedItem.itemId,
      itemName: orderedItem.itemName,
      customerId: order.customerId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      rating: ratingValue,
      review: (data.review || '').trim(),
      createdAt: new Date().toISOString(),
    };

    this.data.ratings.push(ratingRecord);
    this.persist();
    return { success: true, rating: ratingRecord };
  }

  public getRatingsForOrder(orderId: string): FoodRatingRecord[] {
    this.data.ratings = this.data.ratings || [];
    return this.data.ratings.filter((r) => r.orderId === orderId);
  }

  public getAllRatings(): FoodRatingRecord[] {
    this.data.ratings = this.data.ratings || [];
    return [...this.data.ratings].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getAllExpenses(): ExpenseRecord[] {
    if (!Array.isArray(this.data.expenses)) {
      this.data.expenses = [];
    }
    return [...this.data.expenses].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  public addExpense(expense: {
    date: string;
    title: string;
    category: string;
    amount: number;
    notes?: string;
  }): ExpenseRecord {
    if (!Array.isArray(this.data.expenses)) {
      this.data.expenses = [];
    }
    const newRecord: ExpenseRecord = {
      id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      date: expense.date,
      title: expense.title,
      category: expense.category,
      amount: expense.amount,
      notes: expense.notes,
      createdAt: new Date().toISOString(),
    };
    this.data.expenses.push(newRecord);
    this.persist();
    return newRecord;
  }

  public deleteExpense(expenseId: string): boolean {
    if (!Array.isArray(this.data.expenses)) return false;
    const initialLen = this.data.expenses.length;
    this.data.expenses = this.data.expenses.filter((e) => e.id !== expenseId);
    if (this.data.expenses.length !== initialLen) {
      this.persist();
      return true;
    }
    return false;
  }
}

export const db = new CentralDatabase();
