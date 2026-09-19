import React, { useEffect, useState } from 'react';
import { X, Clock, ChevronRight, RefreshCw, ShoppingBag, MapPin } from 'lucide-react';
import { Order } from '../types';

interface CustomerOrderHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOrder: (orderId: string) => void;
}

const getStatusLabel = (status: string) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'order placed' || normalized === 'new') return 'Pending';
  if (normalized === 'accepted') return 'Accepted';
  if (normalized === 'preparing') return 'Preparing';
  if (normalized === 'ready') return 'Ready';
  if (normalized === 'out for delivery') return 'Out for Delivery';
  if (normalized === 'delivered') return 'Delivered';
  if (normalized === 'order rejected' || normalized === 'rejected') return 'Rejected';
  if (normalized === 'cancelled' || normalized === 'canceled') return 'Cancelled';
  return status || 'Pending';
};

export const CustomerOrderHistory: React.FC<CustomerOrderHistoryProps> = ({
  isOpen,
  onClose,
  onSelectOrder,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      setLoading((current) => (orders.length === 0 ? true : current));
      const token = localStorage.getItem('hm_customer_token');
      if (!token) {
        setLoading(false);
        return;
      }
      const res = await fetch('/api/orders', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Notice: Unable to reach orders server right now:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    fetchOrders();

    // Poll less aggressively to reduce mobile network/battery usage while keeping status fresh.
    const interval = setInterval(fetchOrders, 5000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchOrders();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-[#211c16] border border-[#5b4728] rounded-2xl shadow-2xl text-[#f7f1e6] p-4 sm:p-6 max-h-[88vh] flex flex-col justify-between">
        <div className="flex items-center justify-between pb-4 border-b border-[#5b4728]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 shrink-0 rounded-lg bg-[#2a2118] border border-[#b98b43]/50 flex items-center justify-center text-[#e0b568]">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-brand text-xl font-bold text-[#f7f1e6]">My Orders</h3>
              <span className="text-[11px] text-[#a99d8e]">Hotel Malabar Order History</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="min-h-10 min-w-10 p-1.5 rounded-full hover:bg-[#4f3d25] text-[#b7ab9c] hover:text-[#f7f1e6] cursor-pointer flex items-center justify-center"
            aria-label="Close order history"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 flex-1 overflow-y-auto space-y-3">
          {loading ? (
            <div className="py-12 text-center text-[#a99d8e]">
              <RefreshCw className="w-6 h-6 text-[#e0b568] animate-spin mx-auto mb-2" />
              <p className="text-xs">Loading your order history...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center text-[#a99d8e]">
              <ShoppingBag className="w-10 h-10 text-[#255837] mx-auto mb-2" />
              <p className="text-sm font-medium text-[#ddd4c7]">No orders yet</p>
              <p className="text-xs mt-1">Explore the menu to place your first authentic Malabar meal.</p>
            </div>
          ) : (
            orders.map((order) => {
              const dateStr = new Date(order.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              });
              const statusLabel = getStatusLabel(order.status);

              return (
                <button
                  key={order.id}
                  onClick={() => onSelectOrder(order.id)}
                  className="w-full text-left p-3.5 bg-[#241e17] hover:bg-[#4a3924] border border-[#66502d] hover:border-[#e0b568]/60 rounded-xl transition-all cursor-pointer group flex items-center justify-between gap-3 shadow-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono font-bold text-xs text-[#e0b568]">
                        {order.orderNumber}
                      </span>
                      <span className="text-[10px] bg-[#17130f] border border-[#5b4728] text-[#a99d8e] px-2 py-0.5 rounded-full">
                        {dateStr}
                      </span>
                      {order.customerLatitude && order.customerLongitude && (
                        <span className="text-[10px] bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5 text-emerald-400" />
                          <span>GPS Pin</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[#ddd4c7] truncate font-medium">
                      {order.items.map((i) => `${i.quantity}x ${i.itemName}`).join(', ')}
                    </p>

                    <div className="flex items-center gap-2.5 mt-2 flex-wrap text-[11px]">
                      <span className="font-mono font-bold text-[#e0b568]">₹{order.grandTotal}</span>
                      <span className="text-[#a99d8e]">COD</span>
                      <span
                        className={`font-semibold px-2 py-1 rounded-full text-[10px] ${
                          statusLabel === 'Delivered'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                            : statusLabel === 'Rejected' || statusLabel === 'Cancelled'
                            ? 'bg-red-950 text-red-300 border border-red-700'
                            : 'bg-amber-950 text-amber-300 border border-amber-700 animate-pulse'
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                  </div>

                  <div className="text-[#6d8a76] group-hover:text-[#e0b568] transition-colors shrink-0">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="pt-3 border-t border-[#5b4728] flex justify-end">
          <button
            onClick={onClose}
            className="min-h-10 bg-[#2a2118] hover:bg-[#4f3d25] text-[#ddd4c7] text-xs font-semibold py-2 px-4 rounded-xl border border-[#66502d] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
