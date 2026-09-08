import React, { useEffect, useState } from 'react';
import { X, Clock, ChevronRight, RefreshCw, ShoppingBag, Receipt, MapPin } from 'lucide-react';
import { Order } from '../types';

interface CustomerOrderHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOrder: (orderId: string) => void;
}

export const CustomerOrderHistory: React.FC<CustomerOrderHistoryProps> = ({
  isOpen,
  onClose,
  onSelectOrder,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('hm_customer_token');
      if (!token) return;
      const res = await fetch('/api/orders', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.warn('Notice: Unable to reach orders server right now:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchOrders();
      const interval = setInterval(fetchOrders, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-[#0e2a1b] border border-[#235836] rounded-2xl shadow-2xl text-[#fdfbf7] p-6 max-h-[85vh] flex flex-col justify-between">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1b432a]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#143d26] border border-[#cba135]/50 flex items-center justify-center text-[#dfb64c]">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-brand text-xl font-bold text-[#fcfaf6]">My Orders</h3>
              <span className="text-[11px] text-[#8ea896]">Hotel Malabar Order History</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#184428] text-[#a6bfae] hover:text-[#fdfbf7] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Orders List */}
        <div className="py-4 flex-1 overflow-y-auto space-y-3">
          {loading ? (
            <div className="py-12 text-center text-[#8ea896]">
              <RefreshCw className="w-6 h-6 text-[#dfb64c] animate-spin mx-auto mb-2" />
              <p className="text-xs">Loading your order history...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center text-[#8ea896]">
              <ShoppingBag className="w-10 h-10 text-[#255837] mx-auto mb-2" />
              <p className="text-sm font-medium text-[#c9dcce]">No orders yet</p>
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

              return (
                <div
                  key={order.id}
                  onClick={() => onSelectOrder(order.id)}
                  className="p-3.5 bg-[#113320] hover:bg-[#163e26] border border-[#214f34] hover:border-[#dfb64c]/60 rounded-xl transition-all cursor-pointer group flex items-center justify-between gap-3 shadow-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-xs text-[#dfb64c]">
                        {order.orderNumber}
                      </span>
                      <span className="text-[10px] bg-[#091a10] border border-[#1b432a] text-[#8ea896] px-2 py-0.5 rounded-full">
                        {dateStr}
                      </span>
                      {order.customerLatitude && order.customerLongitude && (
                        <span className="text-[10px] bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5 text-emerald-400" />
                          <span>GPS Pin</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[#c9dcce] truncate font-medium">
                      {order.items.map((i) => `${i.quantity}x ${i.itemName}`).join(', ')}
                    </p>

                    <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                      <span className="font-mono font-bold text-[#dfb64c]">
                        ₹{order.grandTotal}
                      </span>
                      <span className="text-[#8ea896]">COD</span>
                      <span
                        className={`font-semibold px-2 py-0.2 rounded-full text-[10px] ${
                          order.status === 'Delivered'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                            : order.status === 'Order Rejected'
                            ? 'bg-red-950 text-red-300 border border-red-700'
                            : 'bg-amber-950 text-amber-300 border border-amber-700 animate-pulse'
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                  </div>

                  <div className="text-[#6d8a76] group-hover:text-[#dfb64c] transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#1b432a] flex justify-end">
          <button
            onClick={onClose}
            className="bg-[#123620] hover:bg-[#184428] text-[#c9dcce] text-xs font-semibold py-2 px-4 rounded-xl border border-[#245937] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
