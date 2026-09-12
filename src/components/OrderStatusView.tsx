import React, { useEffect, useState, useMemo } from 'react';
import {
  X,
  CheckCircle2,
  Clock,
  ChefHat,
  Bike,
  PackageCheck,
  XCircle,
  Phone,
  RefreshCw,
  Receipt,
  MapPin,
  ExternalLink,
  UtensilsCrossed,
  Sparkles,
  Star,
} from 'lucide-react';
import { Order, OrderStatus } from '../types';

interface OrderStatusViewProps {
  orderId: string;
  onClose: () => void;
}

interface StepItem {
  key: string;
  label: string;
  icon: any;
}

const TRACKING_STEPS: StepItem[] = [
  { key: 'NEW', label: 'Order Received', icon: Clock },
  { key: 'ACCEPTED', label: 'Order Accepted', icon: CheckCircle2 },
  { key: 'PREPARING', label: 'Preparing Food', icon: ChefHat },
  { key: 'READY', label: 'Food Ready & Packed', icon: PackageCheck },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: Bike },
  { key: 'DELIVERED', label: 'Delivered', icon: CheckCircle2 },
];

function normalizeStatusKey(status: OrderStatus): string {
  const s = String(status).toUpperCase().trim();
  if (s === 'NEW' || s === 'ORDER PLACED') return 'NEW';
  if (s === 'ACCEPTED') return 'ACCEPTED';
  if (s === 'PREPARING') return 'PREPARING';
  if (s === 'READY') return 'READY';
  if (s === 'OUT FOR DELIVERY' || s === 'OUT_FOR_DELIVERY') return 'OUT_FOR_DELIVERY';
  if (s === 'DELIVERED') return 'DELIVERED';
  if (s === 'REJECTED' || s === 'ORDER REJECTED') return 'REJECTED';
  if (s === 'CANCELLED') return 'CANCELLED';
  return 'NEW';
}

export const OrderStatusView: React.FC<OrderStatusViewProps> = ({ orderId, onClose }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Food ratings for delivered orders
  const [orderRatings, setOrderRatings] = useState<Record<string, { rating: number; review?: string }>>({});
  const [ratingInputs, setRatingInputs] = useState<Record<string, { rating: number; review: string; hover: number }>>({});
  const [submittingRating, setSubmittingRating] = useState<Record<string, boolean>>({});
  const [ratingError, setRatingError] = useState<Record<string, string>>({});

  const fetchOrderRatings = async () => {
    try {
      const res = await fetch(`/api/ratings/order/${orderId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ratings && Array.isArray(data.ratings)) {
          const map: Record<string, { rating: number; review?: string }> = {};
          data.ratings.forEach((r: any) => {
            map[r.itemId] = { rating: r.rating, review: r.review };
          });
          setOrderRatings(map);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch order ratings:', e);
    }
  };

  const handleSubmitRating = async (itemId: string) => {
    const input = ratingInputs[itemId] || { rating: 5, review: '', hover: 0 };
    if (!input.rating || input.rating < 1 || input.rating > 5) {
      setRatingError((prev) => ({ ...prev, [itemId]: 'Please select a rating between 1 and 5 stars' }));
      return;
    }

    try {
      setSubmittingRating((prev) => ({ ...prev, [itemId]: true }));
      setRatingError((prev) => ({ ...prev, [itemId]: '' }));

      const token = localStorage.getItem('hm_customer_token');
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          orderId,
          itemId,
          rating: input.rating,
          review: input.review ? input.review.trim() : '',
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        setRatingError((prev) => ({ ...prev, [itemId]: resData.error || 'Failed to submit rating' }));
        return;
      }

      setOrderRatings((prev) => ({
        ...prev,
        [itemId]: { rating: input.rating, review: input.review ? input.review.trim() : '' },
      }));

      // Notify window so App.tsx menu updates average ratings
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hm_rating_submitted', { detail: { itemId, rating: input.rating } }));
      }
    } catch (err: any) {
      setRatingError((prev) => ({ ...prev, [itemId]: err.message || 'Error submitting rating' }));
    } finally {
      setSubmittingRating((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const fetchOrder = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      const token = localStorage.getItem('hm_customer_token');
      const res = await fetch(`/api/orders/${orderId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data: Order = await res.json();
        setOrder((prev) => {
          if (
            prev &&
            prev.id === data.id &&
            prev.status === data.status &&
            prev.estimatedReadyAt === data.estimatedReadyAt &&
            prev.preparationMinutes === data.preparationMinutes &&
            prev.updatedAt === data.updatedAt
          ) {
            return prev;
          }
          return data;
        });
      }
    } catch (err) {
      console.warn('Order status sync: reconnecting...');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  // Poll server every 2.5 seconds for real-time status updates (paused when tab hidden or completed)
  useEffect(() => {
    fetchOrder();
    const pollInterval = setInterval(() => {
      if (!document.hidden) {
        fetchOrder();
      }
    }, 2500);

    const handleVisibility = () => {
      if (!document.hidden) {
        fetchOrder();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [orderId]);

  // Live 1-second countdown clock for the timer
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timerInterval);
  }, []);

  useEffect(() => {
    if (order && normalizeStatusKey(order.status) === 'DELIVERED') {
      fetchOrderRatings();
    }
  }, [order?.status, orderId]);

  // Compute remaining time and formatted ready time
  const timerInfo = useMemo(() => {
    if (!order) return null;

    const prepMins = order.preparationMinutes || order.estimatedPrepTimeMinutes || 15;

    let targetMs = 0;
    if (order.estimatedReadyAt) {
      targetMs = new Date(order.estimatedReadyAt).getTime();
    } else if (order.acceptedAt) {
      targetMs = new Date(order.acceptedAt).getTime() + prepMins * 60 * 1000;
    }

    let estimatedReadyTimeStr = '';
    if (targetMs > 0) {
      const d = new Date(targetMs);
      estimatedReadyTimeStr = d.toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }

    const diffSeconds = targetMs > 0 ? Math.floor((targetMs - currentTime) / 1000) : 0;
    const remainingSeconds = Math.max(0, diffSeconds);
    const remainingMinutes = Math.ceil(remainingSeconds / 60);

    return {
      prepMins,
      targetMs,
      estimatedReadyTimeStr,
      remainingSeconds,
      remainingMinutes,
      isTimeReached: targetMs > 0 && diffSeconds <= 0,
    };
  }, [order, currentTime]);

  if (loading || !order) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
        <div className="bg-[#0e2a1b] p-8 rounded-2xl text-center text-[#fdfbf7] border border-[#235836] shadow-2xl">
          <RefreshCw className="w-8 h-8 text-[#dfb64c] animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium">Connecting to Hotel Malabar Kitchen...</p>
        </div>
      </div>
    );
  }

  const normalizedStatus = normalizeStatusKey(order.status);
  const isRejected = normalizedStatus === 'REJECTED';
  const isCancelled = normalizedStatus === 'CANCELLED';

  // Step indices
  const stepKeys = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'];
  const currentStepIndex = stepKeys.indexOf(normalizedStatus);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-md bg-[#0e2a1b] border-2 border-[#26623c] rounded-2xl shadow-2xl text-[#fdfbf7] p-5 sm:p-7 my-6 max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#a6bfae] hover:text-[#fdfbf7] p-1.5 rounded-full hover:bg-[#1a442b] transition-colors cursor-pointer"
          title="Close tracking"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ========================================================================= */}
        {/* CARD HEADER (Requirement 6: Clear customer order tracking card)          */}
        {/* ========================================================================= */}
        <div className="text-center pb-4 border-b border-[#1b432a]">
          <div className="inline-flex items-center gap-1.5 bg-[#143d26] border border-[#cba135]/60 px-3 py-1 rounded-full text-xs font-mono font-bold text-[#dfb64c] mb-1.5 shadow-sm">
            <span>Order {order.orderNumber}</span>
          </div>
          <h2 className="font-brand text-2xl font-bold tracking-wide text-[#fdfbf7]">
            HOTEL MALABAR
          </h2>
          <p className="text-[11px] text-[#8ea896] mt-0.5">
            Placed at{' '}
            {new Date(order.createdAt).toLocaleTimeString('en-IN', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })}{' '}
            • Cash on Delivery
          </p>
        </div>

        {/* ========================================================================= */}
        {/* SPECIAL STATUS: REJECTED OR CANCELLED                                    */}
        {/* ========================================================================= */}
        {isRejected ? (
          <div className="my-5 p-5 bg-red-950/90 border-2 border-red-700 rounded-2xl text-center text-red-200 shadow-lg">
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-2" />
            <h3 className="font-bold text-lg text-red-300">Order Rejected</h3>
            <p className="text-xs mt-2 text-red-200 leading-relaxed">
              {order.rejectionReason ||
                'The kitchen was unable to accept this order due to capacity or item availability. Please call us for assistance.'}
            </p>
          </div>
        ) : isCancelled ? (
          <div className="my-5 p-5 bg-gray-900/90 border-2 border-gray-700 rounded-2xl text-center text-gray-200 shadow-lg">
            <XCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <h3 className="font-bold text-lg text-gray-300">Order Cancelled</h3>
            <p className="text-xs mt-2 text-gray-400">
              This order has been cancelled. If you placed this in error, please call our hotline.
            </p>
          </div>
        ) : (
          /* ========================================================================= */
          /* LIVE PROGRESS STEPPER & COUNTDOWN                                         */
          /* ========================================================================= */
          <div className="my-4 space-y-4">
            {/* Step Progress Checklist (Requirement 6) */}
            <div className="bg-[#091a10] border border-[#1b432a] rounded-2xl p-4 shadow-inner">
              <div className="space-y-2.5">
                {TRACKING_STEPS.map((step, idx) => {
                  const isCompleted = currentStepIndex > idx;
                  const isCurrent = currentStepIndex === idx;
                  const isPending = currentStepIndex < idx;

                  return (
                    <div
                      key={step.key}
                      className={`flex items-center justify-between py-1 px-2 rounded-lg transition-all ${
                        isCurrent
                          ? 'bg-[#153e26] border border-[#dfb64c]/40 text-[#dfb64c]'
                          : isCompleted
                          ? 'text-[#fcfaf6]'
                          : 'text-[#64846e]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Status Marker */}
                        <div className="w-5 text-center font-bold">
                          {isCompleted ? (
                            <span className="text-emerald-400 text-sm">✓</span>
                          ) : isCurrent ? (
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#dfb64c] animate-ping" />
                          ) : (
                            <span className="text-xs text-[#526f5b]">○</span>
                          )}
                        </div>

                        {/* Step Label */}
                        <span
                          className={`text-xs sm:text-sm font-semibold ${
                            isCurrent ? 'text-[#dfb64c]' : isCompleted ? 'text-[#fcfaf6]' : 'text-[#6b8c75]'
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>

                      {isCurrent && (
                        <span className="text-[10px] font-mono uppercase bg-[#1d4f32] text-[#dfb64c] px-2 py-0.5 rounded-full font-bold border border-[#dfb64c]/30">
                          Active
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* LIVE COUNTDOWN & STATUS BANNER (Requirements 4, 5, 6)                     */}
            {/* ========================================================================= */}
            {normalizedStatus === 'NEW' && (
              <div className="p-4 bg-[#123620] border border-[#2b6540] rounded-2xl text-center shadow-md">
                <div className="flex items-center justify-center gap-2 text-[#dfb64c] font-bold text-sm">
                  <Clock className="w-4 h-4 animate-spin text-[#dfb64c]" />
                  <span>Order Received by Kitchen</span>
                </div>
                <p className="text-xs text-[#b8d1c0] mt-1">
                  Our chef is reviewing your order. Food preparation countdown will start as soon as accepted!
                </p>
              </div>
            )}

            {(normalizedStatus === 'ACCEPTED' || normalizedStatus === 'PREPARING') && timerInfo && (
              <div className="p-5 bg-gradient-to-b from-[#143e27] via-[#113521] to-[#0d2a1a] border-2 border-[#dfb64c] rounded-2xl text-center shadow-xl space-y-3">
                <div className="text-[11px] uppercase tracking-widest text-[#a8c7b2] font-semibold">
                  {normalizedStatus === 'ACCEPTED' ? 'Order Accepted' : 'Food In Preparation'}
                </div>

                {timerInfo.isTimeReached ? (
                  <div className="py-2">
                    <div className="text-emerald-300 font-brand text-xl sm:text-2xl font-extrabold tracking-wide animate-pulse">
                      Your food should be ready now.
                    </div>
                    <p className="text-xs text-[#c9dcce] mt-1">
                      Our kitchen is putting the final touches and packing your meal hot!
                    </p>
                  </div>
                ) : (
                  <div className="py-1">
                    <div className="text-xs text-[#dfb64c] font-medium">Food will be ready in</div>
                    <div className="font-brand text-3xl sm:text-4xl font-extrabold text-[#fdfbf7] tracking-wider my-1">
                      {timerInfo.remainingMinutes}{' '}
                      <span className="text-lg font-bold text-[#dfb64c]">
                        {timerInfo.remainingMinutes === 1 ? 'MINUTE' : 'MINUTES'}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-[#8ea896]">
                      ({Math.floor(timerInfo.remainingSeconds / 60)}m {timerInfo.remainingSeconds % 60}s remaining)
                    </div>
                  </div>
                )}

                {timerInfo.estimatedReadyTimeStr && (
                  <div className="pt-2 border-t border-[#1f4e32] flex items-center justify-between text-xs text-[#c9dcce]">
                    <span>Food preparation: {timerInfo.prepMins} MINUTES</span>
                    <span className="font-mono text-[#dfb64c] font-bold">
                      Ready: {timerInfo.estimatedReadyTimeStr}
                    </span>
                  </div>
                )}
              </div>
            )}

            {normalizedStatus === 'READY' && (
              <div className="p-5 bg-gradient-to-r from-emerald-950 via-[#103a24] to-emerald-950 border-2 border-emerald-500 rounded-2xl text-center shadow-xl">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2 border border-emerald-400/40">
                  <PackageCheck className="w-6 h-6" />
                </div>
                <h3 className="font-brand text-xl font-extrabold text-emerald-300">
                  ORDER READY
                </h3>
                <p className="text-xs text-emerald-200 mt-1 font-medium">
                  Your food is freshly cooked, packed hot, and ready for delivery dispatch!
                </p>
              </div>
            )}

            {normalizedStatus === 'OUT_FOR_DELIVERY' && (
              <div className="p-5 bg-gradient-to-r from-amber-950/90 via-[#2a220d] to-amber-950/90 border-2 border-amber-500 rounded-2xl text-center shadow-xl">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-2 border border-amber-400/40 animate-bounce">
                  <Bike className="w-6 h-6" />
                </div>
                <h3 className="font-brand text-xl font-extrabold text-amber-300">
                  OUT FOR DELIVERY
                </h3>
                <p className="text-xs text-amber-100 mt-1 font-medium">
                  Rider is on the way to <strong className="text-amber-300">{order.deliveryArea}</strong>!
                </p>
                <p className="text-[11px] text-amber-200/80 mt-1">
                  Please keep exact cash ₹{order.grandTotal} ready for cash on delivery.
                </p>
              </div>
            )}

            {normalizedStatus === 'DELIVERED' && (
              <div className="p-5 bg-gradient-to-r from-emerald-950 via-[#0d2a19] to-emerald-950 border-2 border-emerald-400 rounded-2xl text-center shadow-xl">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2 border border-emerald-400/40">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="font-brand text-xl font-extrabold text-emerald-300">
                  ORDER DELIVERED
                </h3>
                <p className="text-xs text-emerald-100 mt-1 font-medium">
                  Thank you for ordering with Hotel Malabar. Enjoy your authentic Malabar feast!
                </p>
              </div>
            )}

            {/* ========================================================================= */}
            {/* RATE EACH ORDERED FOOD ITEM (Requirement 1)                               */}
            {/* ========================================================================= */}
            {normalizedStatus === 'DELIVERED' && (
              <div className="mt-4 bg-[#091a10] border-2 border-[#dfb64c]/70 rounded-2xl p-4 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-2.5 border-b border-[#1b432a]">
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                    <div>
                      <h4 className="font-brand font-bold text-sm text-[#fcfaf6]">
                        Rate Your Food Items
                      </h4>
                      <p className="text-[11px] text-[#8ea896]">
                        How was the taste? Rate each item (1 to 5 stars)
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-[#143d26] text-[#dfb64c] border border-[#245937] px-2 py-0.5 rounded-full">
                    Verified Order
                  </span>
                </div>

                <div className="space-y-3">
                  {order.items.map((item) => {
                    const existingRating = orderRatings[item.itemId];
                    const input = ratingInputs[item.itemId] || { rating: 5, review: '', hover: 0 };
                    const isSubmitting = submittingRating[item.itemId];
                    const error = ratingError[item.itemId];

                    return (
                      <div
                        key={item.id || item.itemId}
                        className="bg-[#0f2d1c] border border-[#1f4e30] rounded-xl p-3 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="font-bold text-xs sm:text-sm text-[#fcfaf6] block">
                              {item.itemName}
                            </span>
                            <span className="text-[11px] text-[#8ea896]">
                              Qty: {item.quantity} • ₹{item.price} each
                            </span>
                          </div>

                          {existingRating ? (
                            <div className="flex items-center gap-1 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-2 py-1 rounded-lg text-xs font-bold shrink-0">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Rated {existingRating.rating}/5</span>
                            </div>
                          ) : null}
                        </div>

                        {existingRating ? (
                          <div className="bg-[#08170e] border border-emerald-800/30 rounded-lg p-2 text-xs space-y-1">
                            <div className="flex items-center gap-1 text-amber-400">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={`w-3.5 h-3.5 ${
                                    s <= existingRating.rating
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'text-stone-700'
                                  }`}
                                />
                              ))}
                              <span className="ml-1 text-[11px] text-emerald-300 font-medium">
                                Thank you for rating this item!
                              </span>
                            </div>
                            {existingRating.review && (
                              <p className="text-[11px] text-[#a6bfae] italic">
                                "{existingRating.review}"
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2 pt-1 border-t border-[#163f27]">
                            {/* Star Selector */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((starNum) => {
                                  const displayStar = input.hover || input.rating;
                                  return (
                                    <button
                                      key={starNum}
                                      type="button"
                                      onClick={() =>
                                        setRatingInputs((prev) => ({
                                          ...prev,
                                          [item.itemId]: {
                                            ...prev[item.itemId],
                                            rating: starNum,
                                            review: prev[item.itemId]?.review || '',
                                            hover: 0,
                                          },
                                        }))
                                      }
                                      onMouseEnter={() =>
                                        setRatingInputs((prev) => ({
                                          ...prev,
                                          [item.itemId]: {
                                            ...prev[item.itemId],
                                            rating: prev[item.itemId]?.rating || 5,
                                            review: prev[item.itemId]?.review || '',
                                            hover: starNum,
                                          },
                                        }))
                                      }
                                      onMouseLeave={() =>
                                        setRatingInputs((prev) => ({
                                          ...prev,
                                          [item.itemId]: {
                                            ...prev[item.itemId],
                                            hover: 0,
                                          },
                                        }))
                                      }
                                      className="p-1 text-stone-600 hover:scale-110 transition-transform cursor-pointer focus:outline-none"
                                      title={`${starNum} star`}
                                    >
                                      <Star
                                        className={`w-5 h-5 transition-colors ${
                                          starNum <= displayStar
                                            ? 'fill-amber-400 text-amber-400'
                                            : 'text-stone-600'
                                        }`}
                                      />
                                    </button>
                                  );
                                })}
                              </div>
                              <span className="text-xs font-bold text-[#dfb64c] font-mono">
                                {input.rating || 5} of 5 Stars
                              </span>
                            </div>

                            {/* Optional Review Text */}
                            <input
                              type="text"
                              value={input.review || ''}
                              onChange={(e) =>
                                setRatingInputs((prev) => ({
                                  ...prev,
                                  [item.itemId]: {
                                    ...prev[item.itemId],
                                    rating: prev[item.itemId]?.rating || 5,
                                    hover: 0,
                                    review: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Write a brief comment (optional)..."
                              maxLength={160}
                              className="w-full bg-[#08170e] border border-[#235836] rounded-lg px-2.5 py-1.5 text-xs text-[#fcfaf6] placeholder-[#6d8a76] focus:outline-none focus:border-[#dfb64c]"
                            />

                            {error && (
                              <p className="text-[11px] text-red-400 font-medium">
                                {error}
                              </p>
                            )}

                            <button
                              type="button"
                              onClick={() => handleSubmitRating(item.itemId)}
                              disabled={isSubmitting}
                              className="w-full py-1.5 px-3 rounded-lg bg-[#dfb64c] hover:bg-[#ebd074] disabled:opacity-50 text-[#0a1f13] text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow"
                            >
                              {isSubmitting ? (
                                <>
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  <span>Submitting...</span>
                                </>
                              ) : (
                                <>
                                  <Star className="w-3.5 h-3.5 fill-[#0a1f13]" />
                                  <span>Submit Rating</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* ORDER DETAILS & RECEIPT SUMMARY                                           */}
        {/* ========================================================================= */}
        <div className="bg-[#091a10] border border-[#1b432a] rounded-2xl p-4 text-xs space-y-3 mt-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#1b432a]">
            <span className="font-semibold text-[#dfb64c] flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5" />
              <span>Bill Summary</span>
            </span>
            <span className="bg-[#123620] text-[#e0d8c7] px-2 py-0.5 rounded font-mono text-[10px]">
              Cash on Delivery
            </span>
          </div>

          <div className="space-y-1.5">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-[#c9dcce]">
                <span>
                  <strong className="text-[#dfb64c] mr-1">{item.quantity}x</strong> {item.itemName}
                </span>
                <span className="font-mono">₹{item.subtotal}</span>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-[#1b432a] space-y-1">
            <div className="flex justify-between text-[#8ea896]">
              <span>Food Total:</span>
              <span className="font-mono">₹{order.foodTotal}</span>
            </div>
            <div className="flex justify-between text-[#8ea896]">
              <span>Delivery Charge ({order.deliveryDistanceKm} km):</span>
              <span className="font-mono">
                {order.deliveryCharge === 0 ? 'FREE' : `₹${order.deliveryCharge}`}
              </span>
            </div>
            <div className="flex justify-between text-sm font-bold text-[#dfb64c] pt-1 border-t border-[#1b432a]">
              <span>Grand Total:</span>
              <span className="font-mono">₹{order.grandTotal}</span>
            </div>
          </div>

          {/* Delivery Location Details */}
          <div className="pt-2 border-t border-[#1b432a] text-[11px] text-[#9bb5a4]">
            <span className="font-semibold text-[#c9dcce] block">Delivery Address:</span>
            <span className="block mt-0.5">{order.deliveryAddress} ({order.deliveryArea})</span>
            <div className="mt-2 pt-1.5 border-t border-[#184227]">
              <span className="font-semibold text-[#c9dcce] block text-[10px] uppercase">Special Instructions:</span>
              {order.specialInstructions && order.specialInstructions.trim() ? (
                <span className="block text-[#dfb64c] mt-0.5 bg-[#123620] p-1.5 rounded border border-[#245937]">
                  📝 {order.specialInstructions.trim()}
                </span>
              ) : (
                <span className="block text-[#6d8a76] italic mt-0.5 text-[10px]">
                  No special instructions
                </span>
              )}
            </div>
            {order.customerLatitude && order.customerLongitude && (
              <div className="mt-2 flex items-center justify-between bg-[#123620] px-2.5 py-1.5 rounded-lg border border-[#245937] text-[10px]">
                <span className="text-emerald-300 flex items-center gap-1 font-semibold">
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  <span>GPS Location Attached</span>
                </span>
                <a
                  href={order.googleMapsUrl || `https://www.google.com/maps?q=${order.customerLatitude},${order.customerLongitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#dfb64c] hover:underline font-semibold flex items-center gap-0.5 ml-2"
                >
                  <span>Google Maps</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FOOTER ACTIONS                                                            */}
        {/* ========================================================================= */}
        <div className="mt-4 flex items-center justify-between gap-2.5 pt-3 border-t border-[#1b432a]">
          <a
            href="tel:9567562071"
            className="flex-1 bg-[#123620] hover:bg-[#184428] text-[#c9dcce] py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-[#245937] transition-all cursor-pointer"
          >
            <Phone className="w-3.5 h-3.5 text-[#dfb64c]" />
            <span>Call Restaurant</span>
          </a>

          <button
            onClick={() => fetchOrder(true)}
            disabled={refreshing}
            className="bg-[#163d25] hover:bg-[#205534] text-[#dfb64c] py-2.5 px-3.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-[#cba135]/40 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Syncing...' : 'Sync'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
