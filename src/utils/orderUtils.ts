import { Order, DailyExpense } from '../types';

const istDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Returns a date formatted as YYYY-MM-DD strictly in Asia/Kolkata (IST) timezone.
 */
export function getLocalDateString(input?: string | number | Date): string {
  if (!input && input !== 0) {
    return istDateFormatter.format(new Date());
  }
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '';
  return istDateFormatter.format(d);
}

/**
 * Checks if an order was placed on today's local date (or reference date).
 */
export function isOrderToday(createdAt: string, referenceDateYMD?: string): boolean {
  if (!createdAt) return false;
  const todayYMD = referenceDateYMD || getLocalDateString();
  return getLocalDateString(createdAt) === todayYMD;
}

/**
 * Checks if an order was placed on a specific YYYY-MM-DD date.
 */
export function isOrderFromDate(createdAt: string, targetDateYMD: string): boolean {
  if (!createdAt || !targetDateYMD) return false;
  return getLocalDateString(createdAt) === targetDateYMD;
}

/**
 * Checks if an order is in a pending/new unaccepted state.
 */
export function isPendingNewOrder(order: Order): boolean {
  const s = (order.status || '').toLowerCase();
  return s === 'order placed' || s === 'new';
}

/**
 * Checks if an order is accepted (in kitchen, preparing, ready, out for delivery, delivered).
 */
export function isAcceptedOrder(order: Order): boolean {
  const s = (order.status || '').toLowerCase();
  return (
    s === 'accepted' ||
    s === 'preparing' ||
    s === 'ready' ||
    s === 'out for delivery' ||
    s === 'delivered'
  );
}

/**
 * Checks if an order has been rejected or cancelled.
 */
export function isRejectedOrder(order: Order): boolean {
  const s = (order.status || '').toLowerCase();
  return s === 'order rejected' || s === 'rejected' || s === 'cancelled';
}

/**
 * Requirement 6: COUNT VALID ORDERS ONLY.
 * Excludes rejected, cancelled, and failed orders.
 */
export function isValidOrder(order: Order): boolean {
  if (!order) return false;
  if (isRejectedOrder(order)) return false;
  const s = (order.status || '').toLowerCase();
  if (s === 'cancelled' || s === 'canceled' || s === 'failed') return false;
  if (order.paymentStatus === 'failed') return false;
  return true;
}

/**
 * Requirement 5: TOTAL PAYMENT / COLLECTION
 * Actual payment/collection amount according to the Hotel Malabar payment logic.
 * - For Cash on Delivery: Payment is collected upon actual delivery (status is 'Delivered') or when paymentStatus is 'completed'.
 * - For Online/Prepaid: Payment is collected upon order placement.
 * - When an order is still in progress (Accepted/Preparing/Ready/Out for Delivery) with COD, collection is pending.
 */
export function isPaymentCollected(order: Order): boolean {
  if (!isValidOrder(order)) return false;
  if (order.paymentStatus === 'completed') return true;
  const s = (order.status || '').toLowerCase();
  if (s === 'delivered') return true;
  const pm = (order.paymentMethod || '').toLowerCase();
  if (pm && !pm.includes('cash') && (pm.includes('online') || pm.includes('upi') || pm.includes('card') || pm.includes('paid'))) {
    return true;
  }
  return false;
}

/**
 * Extracts the true numeric total of an order.
 */
export function getOrderAmount(order: Order): number {
  if (typeof order.grandTotal === 'number' && !isNaN(order.grandTotal)) {
    return order.grandTotal;
  }
  if (typeof order.foodTotal === 'number') {
    return order.foodTotal + (order.deliveryCharge || 0);
  }
  if (Array.isArray(order.items)) {
    return (
      order.items.reduce(
        (sum, it) => sum + (it.subtotal || (it.price || 0) * (it.quantity || 1)),
        0
      ) + (order.deliveryCharge || 0)
    );
  }
  return 0;
}

/**
 * Formats a YYYY-MM-DD string into Indian calendar date style (e.g., "12 September 2026").
 */
export function formatCalendarDate(dateYMD: string): string {
  if (!dateYMD) return '';
  const [year, month, day] = dateYMD.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Formats a YYYY-MM-DD string into human-friendly label (e.g., "Today (12 Sep 2026)", "07 Sep 2026").
 */
export function formatDateLabel(dateYMD: string): string {
  if (!dateYMD) return '';
  const todayYMD = getLocalDateString();
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayYMD = getLocalDateString(yesterday);

  const [year, month, day] = dateYMD.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const formatted = d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  if (dateYMD === todayYMD) {
    return `Today (${formatted})`;
  }
  if (dateYMD === yesterdayYMD) {
    return `Yesterday (${formatted})`;
  }
  return formatted;
}

export interface DaySalesMetric {
  dateYMD: string;
  formattedDate: string;
  calendarDate: string; // e.g. "12 September 2026"
  isToday: boolean;
  totalOrders: number; // Valid orders count (excludes rejected/cancelled/failed)
  totalBusiness: number; // Total value of valid orders
  totalPayment: number; // Actual collected payment amount for valid orders
  totalExpense: number; // Daily expense from DB
  netAmount: number; // totalPayment - totalExpense
  pendingCollection: number; // totalBusiness - totalPayment (COD pending upon delivery)
  allOrdersCount: number; // All orders including rejected
  newOrders: number;
  acceptedOrders: number;
  deliveredOrders: number;
  rejectedOrders: number;
  totalSales: number; // Backward-compatible alias for totalBusiness
}

/**
 * Calculates sales metrics for a given date from the orders array.
 * Strictly counts valid orders only (excludes rejected, cancelled, and failed).
 */
export function calculateDateSalesMetrics(
  orders: Order[],
  targetDateYMD: string,
  dailyExpense: number = 0,
  referenceDateYMD?: string
): DaySalesMetric {
  const currentTodayYMD = referenceDateYMD || getLocalDateString();
  const ordersOnDate = orders.filter((o) => isOrderFromDate(o.createdAt, targetDateYMD));
  const newOrders = ordersOnDate.filter(isPendingNewOrder).length;
  const acceptedOrders = ordersOnDate.filter((o) => isAcceptedOrder(o) && (o.status || '').toLowerCase() !== 'delivered').length;
  const deliveredOrders = ordersOnDate.filter((o) => (o.status || '').toLowerCase() === 'delivered').length;
  const rejectedOrders = ordersOnDate.filter(isRejectedOrder).length;

  // Requirement 6: COUNT VALID ORDERS ONLY
  const validOrders = ordersOnDate.filter(isValidOrder);
  const totalOrders = validOrders.length;

  // Requirement 4 & 5: Total Business / Sales
  const totalBusiness = validOrders.reduce((sum, o) => sum + getOrderAmount(o), 0);

  // Requirement 4 & 5: Total Payment / Collection
  const totalPayment = validOrders
    .filter(isPaymentCollected)
    .reduce((sum, o) => sum + getOrderAmount(o), 0);

  // Requirement 4: Expense & Net Amount
  const totalExpense = dailyExpense || 0;
  const netAmount = totalPayment - totalExpense;
  const pendingCollection = Math.max(0, totalBusiness - totalPayment);

  return {
    dateYMD: targetDateYMD,
    formattedDate: formatDateLabel(targetDateYMD),
    calendarDate: formatCalendarDate(targetDateYMD),
    isToday: targetDateYMD === currentTodayYMD,
    totalOrders,
    totalBusiness,
    totalPayment,
    totalExpense,
    netAmount,
    pendingCollection,
    allOrdersCount: ordersOnDate.length,
    newOrders,
    acceptedOrders,
    deliveredOrders,
    rejectedOrders,
    totalSales: totalBusiness,
  };
}

export interface DailyOrderGroup {
  dateYMD: string;
  formattedDate: string;
  calendarDate: string; // e.g. "12 September 2026"
  isToday: boolean;
  metrics: DaySalesMetric;
  orders: Order[];
}

/**
 * Requirement 7, 8, 9: Organizes orders by actual order DATE.
 * Automatically sorts newest date first.
 */
export function groupOrdersByDate(
  orders: Order[],
  expenses: DailyExpense[] = [],
  referenceDateYMD?: string
): DailyOrderGroup[] {
  const dateMap = new Map<string, Order[]>();

  // Ensure today's date is included
  const todayYMD = referenceDateYMD || getLocalDateString();
  dateMap.set(todayYMD, []);

  // Populate map with all orders by local date
  for (const order of orders) {
    if (!order.createdAt) continue;
    const dateYMD = getLocalDateString(order.createdAt);
    if (!dateMap.has(dateYMD)) {
      dateMap.set(dateYMD, []);
    }
    dateMap.get(dateYMD)!.push(order);
  }

  // Precompute expenses per date
  const expenseMap = new Map<string, number>();
  for (const exp of expenses) {
    if (!exp.date) continue;
    const current = expenseMap.get(exp.date) || 0;
    expenseMap.set(exp.date, current + (exp.amount || 0));
  }

  // Sort dates descending (newest first).
  // Always include today's date, and include past dates that have orders or recorded expenses.
  const sortedDates = Array.from(dateMap.keys())
    .filter((dateYMD) => {
      if (dateYMD === todayYMD) return true;
      const ords = dateMap.get(dateYMD) || [];
      const hasExpense = (expenseMap.get(dateYMD) || 0) > 0;
      return ords.length > 0 || hasExpense;
    })
    .sort()
    .reverse();

  return sortedDates.map((dateYMD) => {
    const ordersForDate = dateMap.get(dateYMD) || [];
    // Sort orders for this date: newest first
    const sortedOrders = [...ordersForDate].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const dayExpense = expenseMap.get(dateYMD) || 0;
    const metrics = calculateDateSalesMetrics(orders, dateYMD, dayExpense, todayYMD);

    return {
      dateYMD,
      formattedDate: formatDateLabel(dateYMD),
      calendarDate: formatCalendarDate(dateYMD),
      isToday: dateYMD === todayYMD,
      metrics,
      orders: sortedOrders,
    };
  });
}

/**
 * Aggregates daily sales across all available order dates for charts.
 */
export function aggregateDailySales(orders: Order[], limitDays: number = 7): DaySalesMetric[] {
  const dateMap = new Map<string, Order[]>();

  const todayYMD = getLocalDateString();
  dateMap.set(todayYMD, []);

  for (const order of orders) {
    if (!order.createdAt) continue;
    const dateYMD = getLocalDateString(order.createdAt);
    if (!dateMap.has(dateYMD)) {
      dateMap.set(dateYMD, []);
    }
    dateMap.get(dateYMD)!.push(order);
  }

  const sortedDates = Array.from(dateMap.keys()).sort();
  const recentDates = sortedDates.slice(-limitDays);

  return recentDates.map((dateYMD) => calculateDateSalesMetrics(orders, dateYMD));
}
