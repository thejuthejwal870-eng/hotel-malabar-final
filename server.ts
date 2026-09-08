import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import jwt from 'jsonwebtoken';
import { db, AUTHORIZED_ADMIN_PHONES } from './server/db.ts';

export const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'hotel-malabar-secure-secret-key-2026';

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Permissive CORS headers for API requests
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Normalize Netlify function URLs so both local (/api/...) and Netlify (/.netlify/functions/api/...) match cleanly
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.url.startsWith('/.netlify/functions/api')) {
    req.url = req.url.replace('/.netlify/functions/api', '/api');
  } else if (
    !req.url.startsWith('/api') &&
    (req.url.startsWith('/auth') ||
      req.url.startsWith('/menu') ||
      req.url.startsWith('/cart') ||
      req.url.startsWith('/orders') ||
      req.url.startsWith('/admin') ||
      req.url.startsWith('/health') ||
      req.url.startsWith('/delivery') ||
      req.url.startsWith('/profile'))
  ) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  next();
});

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    phone: string;
    role: 'customer' | 'admin';
  };
}

// Customer Auth Middleware
function requireCustomerAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please login.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: 'Invalid or expired session token.' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid session. Please login again.' });
  }
}

// Admin Auth Middleware - strictly verify role is admin AND phone is one of the 3 authorized numbers
function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Admin access restricted. Authorization token required.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (
      !decoded ||
      decoded.role !== 'admin' ||
      !AUTHORIZED_ADMIN_PHONES.includes(decoded.phone as any)
    ) {
      return res.status(403).json({
        error: 'Access forbidden. Only authorized Hotel Malabar admin accounts are permitted.',
      });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Admin session expired or invalid. Please login.' });
  }
}

// ==========================================
// HEALTH & AUTH ROUTES (NO OTP)
// ==========================================

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Register
app.post('/api/auth/register', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { phone, firstName, lastName, password } = req.body || {};

    if (!phone || !firstName || !lastName || !password) {
      return res.status(400).json({
        error: 'First Name, Last Name, Phone Number, and Password are all required.',
      });
    }

    const cleanPhone = String(phone).trim();
    const cleanFirstName = String(firstName).trim();
    const cleanLastName = String(lastName).trim();
    const cleanPassword = String(password);

    if (!cleanPhone || !cleanFirstName || !cleanLastName || !cleanPassword) {
      return res.status(400).json({
        error: 'All fields must contain valid non-empty values.',
      });
    }

    if (cleanPassword.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long.',
      });
    }

    const { user, profile } = db.registerCustomer({
      phone: cleanPhone,
      firstName: cleanFirstName,
      lastName: cleanLastName,
      password: cleanPassword,
    });

    const token = jwt.sign(
      { id: user.id, phone: user.phone, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const safeUser = {
      id: user.id,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      createdAt: user.createdAt,
    };

    return res.status(201).json({
      message: 'Account created successfully. Welcome to Hotel Malabar!',
      token,
      user: safeUser,
      profile,
    });
  } catch (err: any) {
    console.error('Customer registration error:', err);
    return res.status(400).json({
      error: err.message || 'Registration failed. Please try again.',
    });
  }
});

// Login
app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: 'Please enter registered phone number and password.' });
    }

    const user = db.verifyCustomerLogin(phone, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid phone number or password.' });
    }

    const token = jwt.sign(
      { id: user.id, phone: user.phone, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const profile = db.getCustomerProfile(user.id);
    const safeUser = {
      id: user.id,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      createdAt: user.createdAt,
    };

    res.json({
      message: 'Login successful. Welcome back!',
      token,
      user: safeUser,
      profile,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login failed' });
  }
});

// Verify Privacy PIN (For sensitive unlock / privacy verification)
app.post('/api/auth/verify-pin', (req: Request, res: Response) => {
  try {
    const { phone, userId, privacyPin } = req.body;
    let targetUserId = userId;

    if (!targetUserId && phone) {
      const user = db.findUserByPhone(phone);
      if (user) targetUserId = user.id;
    }

    if (!targetUserId || !privacyPin) {
      return res.status(400).json({ error: 'User identifier and Privacy PIN are required.' });
    }

    const isValid = db.verifyCustomerPin(targetUserId, privacyPin);
    if (!isValid) {
      return res.status(401).json({ error: 'Incorrect Privacy PIN.' });
    }

    res.json({ verified: true, message: 'Privacy PIN verified successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Verification failed' });
  }
});

// Non-OTP Password Recovery using Registered Phone + Privacy PIN
app.post('/api/auth/reset-password', (req: Request, res: Response) => {
  try {
    const { phone, privacyPin, newPassword } = req.body;
    if (!phone || !privacyPin || !newPassword) {
      return res.status(400).json({ error: 'Phone number, Privacy PIN, and new password are required.' });
    }

    db.resetCustomerPasswordWithPin(phone, privacyPin, newPassword);

    res.json({
      success: true,
      message: 'Password reset successfully using verified Privacy PIN. You can now login.',
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Password reset failed' });
  }
});

// Get Current User
app.get('/api/auth/me', requireCustomerAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = db.findUserById(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const profile = db.getCustomerProfile(user.id);
    const safeUser = {
      id: user.id,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      createdAt: user.createdAt,
    };
    res.json({ user: safeUser, profile });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Profile
app.put('/api/auth/profile', requireCustomerAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { address, landmark, deliveryArea, notes } = req.body;
    const updated = db.updateCustomerProfile(req.user!.id, {
      address,
      landmark,
      deliveryArea,
      notes,
    });
    res.json({ profile: updated, message: 'Delivery details saved.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// RESTAURANT SETTINGS & MENU
// ==========================================

app.get('/api/settings', (req: Request, res: Response) => {
  try {
    const deliverySettings = db.getDeliverySettings();
    const deliveryAreas = db.getDeliveryAreas();
    res.json({ deliverySettings, deliveryAreas });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/menu', (req: Request, res: Response) => {
  try {
    const categories = db.getMenuCategories();
    const items = db.getMenuItems();
    const profile = db.getRestaurantProfile();
    res.json({ categories, items, profile });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/profile', (req: Request, res: Response) => {
  try {
    const profile = db.getRestaurantProfile();
    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// CUSTOMER ORDERS
// ==========================================

app.post('/api/orders', requireCustomerAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      deliveryAddress,
      deliveryArea,
      items,
      specialInstructions,
      customerLatitude,
      customerLongitude,
    } = req.body;
    const user = db.findUserById(req.user!.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Your cart is empty. Please add items.' });
    }

    if (!deliveryAddress || !deliveryArea) {
      return res.status(400).json({ error: 'Please enter a complete delivery address and select an area.' });
    }

    // Validate GPS coordinates if provided
    let lat: number | undefined = undefined;
    let lng: number | undefined = undefined;
    if (
      typeof customerLatitude === 'number' &&
      !isNaN(customerLatitude) &&
      customerLatitude >= -90 &&
      customerLatitude <= 90
    ) {
      lat = customerLatitude;
    }
    if (
      typeof customerLongitude === 'number' &&
      !isNaN(customerLongitude) &&
      customerLongitude >= -180 &&
      customerLongitude <= 180
    ) {
      lng = customerLongitude;
    }

    const order = db.createOrder({
      customerId: user.id,
      customerName: `${user.firstName} ${user.lastName}`.trim(),
      customerPhone: user.phone,
      deliveryAddress,
      deliveryArea,
      items,
      specialInstructions,
      customerLatitude: lat,
      customerLongitude: lng,
    });

    res.status(201).json({
      message: `Order ${order.orderNumber} placed successfully! Preparing for cash on delivery.`,
      order,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to place order' });
  }
});

app.get('/api/orders', requireCustomerAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const orders = db.getCustomerOrders(req.user!.id);
    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/:orderId', (req: Request, res: Response) => {
  try {
    const order = db.getOrderById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Strict customer permission rule:
    // Customers can ONLY view their own orders. Other customers' information is strictly blocked.
    // Authorized Hotel Malabar Admin accounts can view orders for kitchen & delivery management.
    let isAuthorized = false;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (
          (decoded.role === 'admin' && AUTHORIZED_ADMIN_PHONES.includes(decoded.phone)) ||
          (decoded.id === order.customerId)
        ) {
          isAuthorized = true;
        }
      } catch {
        // Token invalid or expired
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({
        error: 'Access denied. You are only authorized to view your own order details.',
      });
    }

    res.json(order);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ADMIN DASHBOARD & RESTAURANT MANAGEMENT
// ==========================================

app.post('/api/admin/login', (req: Request, res: Response) => {
  try {
    const { phone, identifier } = req.body;
    const adminPhone = String(phone || identifier || '').trim();

    if (!adminPhone) {
      return res.status(400).json({ error: 'Authorized admin phone number is required.' });
    }

    if (!AUTHORIZED_ADMIN_PHONES.includes(adminPhone as any)) {
      return res.status(403).json({
        error: 'Unauthorized Admin Number',
      });
    }

    const admin = db.getAuthorizedAdminByPhone(adminPhone);
    if (!admin) {
      return res.status(403).json({ error: 'Unauthorized Admin Number' });
    }

    const token = jwt.sign(
      { id: admin.id, phone: admin.phone, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Admin access granted.',
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
        role: admin.role,
        phone: admin.phone,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Session Status Check
app.get('/api/admin/status', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    status: 'ok',
    admin: req.user,
  });
});

// Admin Password Update (Stored securely via bcrypt hashing)
app.post('/api/admin/change-password', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }
    if (!req.user || !req.user.phone) {
      return res.status(403).json({ error: 'Unauthorized admin user session.' });
    }
    db.changeAdminPassword(req.user.phone, currentPassword, newPassword);
    res.json({ message: 'Admin password updated securely.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get Orders for Admin
app.get('/api/admin/orders', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const orders = db.getAllOrders();
    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Order Status & Prep Time
app.put('/api/admin/orders/:orderId/status', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { status, estimatedPrepTimeMinutes, preparationMinutes, rejectionReason } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required.' });
    }

    const prepTime =
      estimatedPrepTimeMinutes !== undefined
        ? Number(estimatedPrepTimeMinutes)
        : preparationMinutes !== undefined
        ? Number(preparationMinutes)
        : undefined;

    const updated = db.updateOrderStatus(
      req.params.orderId,
      status,
      prepTime,
      rejectionReason
    );

    res.json({ order: updated, message: `Order status updated to ${status}.` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Update Order Prep Time Specifically
app.put('/api/admin/orders/:orderId/prep-time', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { prepTimeMinutes, preparationMinutes, minutes } = req.body;
    const mins = Number(prepTimeMinutes || preparationMinutes || minutes);
    if (!mins || isNaN(mins) || mins <= 0) {
      return res.status(400).json({ error: 'Valid preparation minutes number is required.' });
    }

    const updated = db.updateOrderPrepTime(req.params.orderId, mins);
    res.json({ order: updated, message: `Preparation time updated to ${mins} minutes.` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get Customers List for Admin
app.get('/api/admin/customers', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const customers = db.getAllCustomersWithOrders();
    res.json(customers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Menu Management
app.post('/api/admin/menu/items', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { categoryId, name, description, price, imageUrl, isVeg, isAvailable, prepTimeMinutes } = req.body;
    if (!categoryId || !name || price === undefined) {
      return res.status(400).json({ error: 'Category, name, and price are required.' });
    }

    const newItem = db.addMenuItem({
      categoryId,
      name,
      description: description || '',
      price: Number(price),
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80',
      isVeg: Boolean(isVeg),
      isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : true,
      prepTimeMinutes: Number(prepTimeMinutes) || 10,
      sortOrder: 99,
    });

    res.status(201).json({ item: newItem, message: 'Menu item created successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/menu/items/:id', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const updated = db.updateMenuItem(req.params.id, req.body);
    res.json({ item: updated, message: 'Menu item updated.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/menu/items/:id', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const deleted = db.deleteMenuItem(req.params.id);
    res.json({ success: deleted, message: 'Menu item deleted.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/menu/items/reorder', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds array is required' });
    }
    const items = db.reorderMenuItems(orderedIds);
    res.json({ items, message: 'Menu items reordered successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/menu/items/:id/move', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { direction } = req.body;
    if (direction !== 'up' && direction !== 'down') {
      return res.status(400).json({ error: "Direction must be 'up' or 'down'" });
    }
    const items = db.moveMenuItem(req.params.id, direction);
    res.json({ items, message: `Item moved ${direction}` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Category Management
app.post('/api/admin/menu/categories', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { name, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });
    const cat = db.addCategory({
      name,
      icon: icon || 'Utensils',
      displayOrder: db.getMenuCategories().length + 1,
      isActive: true,
    });
    res.status(201).json(cat);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/menu/categories/:id', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const cat = db.updateCategory(req.params.id, req.body);
    res.json(cat);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/menu/categories/:id', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { reassignToCategoryId } = req.body || {};
    const deleted = db.deleteCategory(req.params.id, reassignToCategoryId);
    res.json({ success: deleted, message: 'Category deleted' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/menu/categories/reorder', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds array is required' });
    }
    const categories = db.reorderCategories(orderedIds);
    res.json({ categories, message: 'Categories reordered successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/menu/categories/:id/move', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { direction } = req.body;
    if (direction !== 'up' && direction !== 'down') {
      return res.status(400).json({ error: "Direction must be 'up' or 'down'" });
    }
    const categories = db.moveCategory(req.params.id, direction);
    res.json({ categories, message: `Category moved ${direction}` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Restaurant Profile Management
app.put('/api/admin/profile', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const updated = db.updateRestaurantProfile(req.body);
    res.json({
      profile: updated,
      message: 'Hotel Malabar profile updated successfully.',
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Quick toggle restaurant open/closed status (Manual open, manual close, or auto schedule)
app.post('/api/admin/restaurant/status', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { manualStatus, isRestaurantOpen } = req.body;
    const current = db.getDeliverySettings();
    let nextStatus: 'auto' | 'open' | 'closed' = current.manualStatus || 'auto';
    if (manualStatus && ['auto', 'open', 'closed'].includes(manualStatus)) {
      nextStatus = manualStatus;
    } else if (typeof isRestaurantOpen === 'boolean') {
      nextStatus = isRestaurantOpen ? 'open' : 'closed';
    }
    const updated = db.updateDeliverySettings({ manualStatus: nextStatus });
    res.json({
      success: true,
      deliverySettings: updated,
      message: `Restaurant status updated: ${updated.isRestaurantOpen ? 'OPEN' : 'CLOSED'} (${updated.manualStatus}).`,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Settings & Areas
app.put('/api/admin/settings', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { deliverySettings, deliveryAreas } = req.body;
    if (deliverySettings) {
      db.updateDeliverySettings(deliverySettings);
    }
    if (deliveryAreas && Array.isArray(deliveryAreas)) {
      db.updateDeliveryAreas(deliveryAreas);
    }
    res.json({
      message: 'Restaurant delivery settings updated.',
      deliverySettings: db.getDeliverySettings(),
      deliveryAreas: db.getDeliveryAreas(),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Format thermal KOT (Kitchen Order Ticket) for 58mm or 80mm printer
app.get('/api/admin/kot/:orderId', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const order = db.getOrderById(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const width = (req.query.width as string) === '80mm' ? '80mm' : '58mm';
    const charWidth = width === '80mm' ? 42 : 30;

    const divider = '='.repeat(charWidth);
    const subDivider = '-'.repeat(charWidth);

    const dateStr = new Date(order.createdAt).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timeStr = new Date(order.createdAt).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    let lines: string[] = [];
    lines.push('*** KITCHEN ORDER TICKET ***');
    lines.push('       HOTEL MALABAR        ');
    lines.push('Contact: 9567562071 / 8904634717');
    lines.push(divider);
    lines.push(`ORDER: ${order.orderNumber}`);
    lines.push(`DATE : ${dateStr}  ${timeStr}`);
    lines.push(`CUST : ${order.customerName}`);
    lines.push(`PHONE: ${order.customerPhone}`);
    lines.push(`AREA : ${order.deliveryArea} (${order.deliveryDistanceKm} km)`);
    lines.push(`ADDR : ${order.deliveryAddress}`);
    if (order.specialInstructions) {
      lines.push(`NOTE : ${order.specialInstructions}`);
    }
    lines.push(subDivider);
    lines.push('QTY  ITEM                   TOTAL');
    lines.push(subDivider);

    order.items.forEach((item) => {
      const qtyStr = `${item.quantity}x`.padEnd(4, ' ');
      const nameStr = item.itemName.length > (charWidth - 12)
        ? item.itemName.substring(0, charWidth - 14) + '..'
        : item.itemName.padEnd(charWidth - 12, ' ');
      const priceStr = `Rs.${item.subtotal}`.padStart(7, ' ');
      lines.push(`${qtyStr}${nameStr}${priceStr}`);
    });

    lines.push(subDivider);
    lines.push(`FOOD TOTAL     : Rs. ${order.foodTotal}`);
    lines.push(`DELIVERY CHARGE: Rs. ${order.deliveryCharge}`);
    lines.push(`GRAND TOTAL    : Rs. ${order.grandTotal}`);
    lines.push(divider);
    lines.push('PAYMENT: CASH ON DELIVERY ONLY');
    lines.push(`STATUS : ${order.status.toUpperCase()}`);
    lines.push(`EST PREP TIME: ${order.estimatedPrepTimeMinutes} MINS`);
    lines.push(divider);
    lines.push('   PLEASE PREPARE IMMEDIATELY   ');

    const formattedText = lines.join('\n');
    res.json({
      order,
      width,
      formattedText,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Handle unmatched API routes with clean JSON response
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.path}` });
});

// Global API error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled server error:', err);
  if (res.headersSent) {
    return next(err);
  }
  if (req.path && req.path.startsWith('/api')) {
    return res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
    });
  }
  next(err);
});

// Vite Middleware for SPA & standalone server startup
export async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hotel Malabar server listening on http://0.0.0.0:${PORT}`);
  });
}

const isServerless = !!(
  process.env.NETLIFY ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT ||
  process.env.NETLIFY_SERVERLESS
);

if (!isServerless) {
  startServer();
}

export default app;
