export interface User {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: 'customer' | 'admin';
  createdAt: string;
}

export interface CustomerProfile {
  userId: string;
  address: string;
  landmark?: string;
  deliveryArea: string;
  notes?: string;
  totalOrders: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  icon: string;
  displayOrder: number;
  isActive: boolean;
}

export interface MenuItem {
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

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

export type OrderStatus =
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

export interface OrderItem {
  id: string;
  orderId: string;
  itemId: string;
  itemName: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface Order {
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
  status: OrderStatus;
  estimatedPrepTimeMinutes: number;
  preparationMinutes?: number;
  acceptedAt?: string;
  estimatedReadyAt?: string;
  readyAt?: string;
  outForDeliveryAt?: string;
  deliveredAt?: string;
  rejectionReason?: string;
  specialInstructions?: string;
  items: OrderItem[];
  customerLatitude?: number;
  customerLongitude?: number;
  googleMapsUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryArea {
  id: string;
  name: string;
  distanceKm: number;
  isActive: boolean;
}

export interface DeliverySettings {
  freeDeliveryKm: number;
  perKmCharge: number;
  minOrderAmount: number;
  isRestaurantOpen: boolean;
  defaultPrepTimeMinutes: number;
  contactPhones: string[];
  restaurantAddress: string;
  openingTime?: string;
  closingTime?: string;
  manualStatus?: 'auto' | 'open' | 'closed';
}

export interface CustomerWithOrders extends User {
  profile?: CustomerProfile;
  orders: Order[];
}

export interface RestaurantProfile {
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
