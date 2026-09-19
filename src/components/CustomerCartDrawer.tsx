import React, { useState, useEffect, memo } from 'react';
import {
  X,
  Trash2,
  Plus,
  Minus,
  Truck,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  MapPin,
  FileText,
  Clock,
  Navigation,
  Loader2,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { CartItem, DeliveryArea, DeliverySettings, User, CustomerProfile, Order } from '../types';

interface CustomerCartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  deliverySettings: DeliverySettings;
  deliveryAreas: DeliveryArea[];
  user: User;
  profile?: CustomerProfile;
  isRestaurantOpen?: boolean;
  onUpdateQuantity: (itemId: string, delta: number) => void;
  onRemoveItem: (itemId: string) => void;
  onClearCart: () => void;
  onOrderPlaced: (order: Order) => void;
}

export const CustomerCartDrawer: React.FC<CustomerCartDrawerProps> = memo(({
  isOpen,
  onClose,
  cartItems,
  deliverySettings,
  deliveryAreas,
  user,
  profile,
  isRestaurantOpen = true,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOrderPlaced,
}) => {
  const [selectedAreaName, setSelectedAreaName] = useState(
    profile?.deliveryArea || deliveryAreas[0]?.name || 'Bommasandra'
  );
  const [address, setAddress] = useState(profile?.address || '');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // GPS Location state for order placement
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (profile?.deliveryArea) {
      setSelectedAreaName(profile.deliveryArea);
    }
    if (profile?.address) {
      setAddress(profile.address);
    }
  }, [profile]);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage({
        type: 'error',
        text: 'Geolocation is not supported by your browser. Please enable location services to place a delivery order.',
      });
      return;
    }

    setIsLocating(true);
    setLocationMessage({
      type: 'info',
      text: 'Detecting your current GPS coordinates...',
    });

    // One-time capture when customer taps button
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setGpsCoords({ latitude, longitude });
        setIsLocating(false);
        setLocationMessage({
          type: 'success',
          text: `GPS Location attached: Lat ${latitude.toFixed(5)}, Lng ${longitude.toFixed(5)}`,
        });
      },
      (geoError) => {
        setIsLocating(false);
        let errorMsg =
          'Please enable browser location permission so we can verify that your delivery location is within our service area.';
        if (geoError.code === geoError.PERMISSION_DENIED) {
          errorMsg =
            'Location permission was denied. Please enable location permission in your browser/device settings to place a delivery order.';
        } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
          errorMsg =
            'Location information is currently unavailable on your device. Please try again.';
        } else if (geoError.code === geoError.TIMEOUT) {
          errorMsg =
            'Location request timed out. Please tap “📍 Use My Current Location” again.';
        }
        setLocationMessage({
          type: 'error',
          text: errorMsg,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  if (!isOpen) return null;

  // Selected area calculation
  const currentArea = deliveryAreas.find((a) => a.name === selectedAreaName) || {
    id: 'default',
    name: selectedAreaName,
    distanceKm: 2.0,
    isActive: true,
  };

  const distanceKm = currentArea.distanceKm;

  // Calculate Food Subtotal
  const foodTotal = cartItems.reduce(
    (sum, item) => sum + item.menuItem.price * item.quantity,
    0
  );

  // Delivery charge formula: First 2 km free, then ₹50 per started km
  const extraKm = Math.max(0, distanceKm - deliverySettings.freeDeliveryKm);
  const startedExtraKm = extraKm > 0 ? Math.ceil(extraKm) : 0;
  const deliveryCharge = startedExtraKm * deliverySettings.perKmCharge;

  const grandTotal = foodTotal + deliveryCharge;
  const isMinOrderMet = foodTotal >= deliverySettings.minOrderAmount;
  const amountNeededForMin = Math.max(0, deliverySettings.minOrderAmount - foodTotal);

  // Check for any out-of-stock items in cart
  const outOfStockItems = cartItems.filter((ci) => !ci.menuItem.isAvailable);
  const hasOutOfStock = outOfStockItems.length > 0;

  const handleProceedToConfirm = () => {
    setError(null);
    if (cartItems.length === 0) {
      setError('Your cart is empty.');
      return;
    }
    if (hasOutOfStock) {
      const names = outOfStockItems.map((ci) => `"${ci.menuItem.name}"`).join(', ');
      setError(
        `Cannot place order: ${names} ${outOfStockItems.length > 1 ? 'are' : 'is'} currently out of stock. Please remove from your cart to proceed.`
      );
      return;
    }
    if (!isMinOrderMet) {
      setError(
        `Minimum food order is ₹${deliverySettings.minOrderAmount}. Please add ₹${amountNeededForMin} more.`
      );
      return;
    }
    if (!gpsCoords) {
      setError('Delivery GPS location is required. Please tap “📍 Use My Current Location” so we can verify that we deliver to your location.');
      setLocationMessage({
        type: 'error',
        text: 'GPS location is required before checkout. Tap “📍 Use My Current Location”.',
      });
      return;
    }
    if (!address.trim()) {
      setError('Please provide your complete delivery address (House/Flat, Street, Landmark).');
      return;
    }
    setShowConfirmModal(true);
  };

  const handlePlaceOrder = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const token = localStorage.getItem('hm_customer_token');
      const payload = {
        deliveryAddress: address.trim(),
        deliveryArea: selectedAreaName,
        items: cartItems.map((ci) => ({
          itemId: ci.menuItem.id,
          quantity: ci.quantity,
        })),
        specialInstructions: specialInstructions.trim() || undefined,
        customerLatitude: gpsCoords?.latitude,
        customerLongitude: gpsCoords?.longitude,
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to place order.');
      }

      onClearCart();
      setShowConfirmModal(false);
      onClose();
      onOrderPlaced(data.order);
    } catch (err: any) {
      setError(err.message || 'Could not place order.');
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#211c16] border-l border-[#5b4728] text-[#f7f1e6] flex flex-col justify-between h-full shadow-2xl relative overflow-y-auto">
        {/* Drawer Header */}
        <div className="p-4 border-b border-[#5b4728] flex items-center justify-between sticky top-0 bg-[#211c16] z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#2a2118] border border-[#b98b43]/50 flex items-center justify-center text-[#e0b568]">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-brand text-lg font-bold !text-black">Your Food Cart</h2>
              <span className="text-[11px] !text-black">Hotel Malabar Fresh Delivery</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#4f3d25] text-[#b7ab9c] hover:text-[#f7f1e6] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="p-4 sm:p-6 space-y-6 flex-1">
          {error && (
            <div className="p-3 bg-red-950/80 border border-red-800 rounded-xl text-xs text-red-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Cart Items List */}
          {cartItems.length === 0 ? (
            <div className="py-12 text-center text-[#a99d8e]">
              <p className="text-base font-medium mb-2">Your cart is currently empty</p>
              <p className="text-xs max-w-xs mx-auto">
                Explore our authentic Kerala biryanis, porottas, curries and shakes to start your order.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs !text-black pb-1 border-b border-[#4a3924]">
                <span>Ordered Items ({cartItems.length})</span>
                <button
                  onClick={onClearCart}
                  className="text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear All</span>
                </button>
              </div>

              {cartItems.map(({ menuItem, quantity }) => {
                const isOutOfStock = menuItem.isAvailable === false;
                return (
                  <div
                    key={menuItem.id}
                    className={`p-3 rounded-xl flex items-center justify-between gap-3 shadow-sm border ${
                      isOutOfStock
                        ? 'bg-red-950/30 border-red-800/80'
                        : 'bg-[#241e17] border-[#66502d]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div
                        className={`w-3 h-3 shrink-0 rounded-sm border flex items-center justify-center ${
                          menuItem.isVeg
                            ? 'border-emerald-500 bg-emerald-950'
                            : 'border-red-500 bg-red-950'
                        }`}
                      >
                        <div
                          className={`w-1.5 h-1.5 ${
                            menuItem.isVeg ? 'rounded-full bg-emerald-400' : 'rotate-45 bg-red-400'
                          }`}
                        />
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-semibold text-[#f7f1e6] truncate">
                            {menuItem.name}
                          </h4>
                          {isOutOfStock && (
                            <span className="text-[10px] font-extrabold uppercase tracking-wider bg-red-900 text-red-100 border border-red-700 px-1.5 py-0.5 rounded shrink-0">
                              OUT OF STOCK
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#e0b568] font-mono">
                          ₹{menuItem.price} × {quantity} = ₹{menuItem.price * quantity}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1.5 bg-[#18130e] border border-[#4f3d25] rounded-lg p-1">
                        <button
                          onClick={() => onUpdateQuantity(menuItem.id, -1)}
                          className="w-6 h-6 rounded bg-[#4a3924] hover:bg-[#5a4529] text-[#f7f1e6] flex items-center justify-center cursor-pointer"
                          title="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono text-xs text-[#e0b568] font-bold px-1.5">
                          {quantity}
                        </span>
                        <button
                          disabled={isOutOfStock}
                          onClick={() => !isOutOfStock && onUpdateQuantity(menuItem.id, 1)}
                          className={`w-6 h-6 rounded flex items-center justify-center font-bold ${
                            isOutOfStock
                              ? 'bg-stone-800 text-stone-600 cursor-not-allowed'
                              : 'bg-[#e0b568] hover:bg-[#ecd06b] text-[#18130e] cursor-pointer'
                          }`}
                          title={isOutOfStock ? 'Item is out of stock' : 'Increase quantity'}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <button
                        onClick={() => onRemoveItem(menuItem.id)}
                        className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                          isOutOfStock
                            ? 'text-red-300 bg-red-950/80 hover:bg-red-900/90 border border-red-700'
                            : 'text-[#a99d8e] hover:text-red-400 hover:bg-red-950/40'
                        }`}
                        title={isOutOfStock ? 'Remove unavailable item' : 'Remove item'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Delivery Area Selection */}
          {cartItems.length > 0 && (
            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold !text-black mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Select Delivery Area</span>
                </label>
                <select
                  value={selectedAreaName}
                  onChange={(e) => setSelectedAreaName(e.target.value)}
                  className="w-full bg-[#2a2118] border border-[#66502d] rounded-xl px-3 py-2.5 text-xs sm:text-sm text-[#f7f1e6] focus:outline-none focus:border-[#e0b568]"
                >
                  {deliveryAreas
                    .filter((a) => a.isActive)
                    .map((area) => (
                      <option key={area.id} value={area.name}>
                        {area.name} ({area.distanceKm} km)
                      </option>
                    ))}
                </select>
              </div>

              {/* GPS CURRENT LOCATION FEATURE (Requirement: At checkout, GPS is mandatory) */}
              <div className="bg-[#0c2417] border border-[#204e31] rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#f7f1e6]">
                    <Navigation className="w-3.5 h-3.5 text-[#e0b568]" />
                    <span>Customer GPS Pin</span>
                  </div>
                  {gpsCoords && (
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-600/70 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>GPS Attached</span>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  id="use-my-current-location-btn"
                  onClick={handleUseCurrentLocation}
                  disabled={isLocating}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow ${
                    gpsCoords
                      ? 'bg-[#154228] border border-[#2f7547] text-[#f7f1e6] hover:bg-[#5a4529]'
                      : 'bg-gradient-to-r from-[#4f3d25] to-[#2a2118] hover:from-[#5a4529] hover:to-[#4f3d25] border border-[#e0b568]/70 text-[#e0b568]'
                  }`}
                >
                  {isLocating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#e0b568]" />
                      <span>Detecting current location...</span>
                    </>
                  ) : gpsCoords ? (
                    <>
                      <span>📍 Update GPS Location</span>
                      <span className="font-mono text-[10px] text-[#a99d8e]">
                        ({gpsCoords.latitude.toFixed(4)}, {gpsCoords.longitude.toFixed(4)})
                      </span>
                    </>
                  ) : (
                    <>
                      <span>📍 Use My Current Location</span>
                    </>
                  )}
                </button>

                {/* Location Status / Feedback Banner */}
                {locationMessage && (
                  <div
                    className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                      locationMessage.type === 'success'
                        ? 'bg-emerald-950/80 border border-emerald-700/80 text-emerald-200'
                        : locationMessage.type === 'error'
                        ? 'bg-amber-950/80 border border-amber-800/80 text-amber-200'
                        : 'bg-[#241e17] border border-[#215132] text-[#ddd4c7]'
                    }`}
                  >
                    {locationMessage.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : locationMessage.type === 'error' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <MapPin className="w-4 h-4 text-[#e0b568] shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 text-[11px] leading-relaxed">
                      {locationMessage.text}
                      {gpsCoords && (
                        <a
                          href={`https://www.google.com/maps?q=${gpsCoords.latitude},${gpsCoords.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#e0b568] hover:underline font-semibold mt-1 ml-1"
                        >
                          <span>Open in Google Maps</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    {gpsCoords && (
                      <button
                        type="button"
                        onClick={() => {
                          setGpsCoords(null);
                          setLocationMessage(null);
                        }}
                        className="text-stone-400 hover:text-stone-200 text-[10px] underline ml-1 cursor-pointer shrink-0"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}

                <p className="text-[10px] text-[#7da087] leading-tight">
                  GPS verification is required at checkout. Your location is checked against Hotel Malabar’s delivery service zone before the order is accepted.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold !text-black mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#799983]" />
                  <span>Delivery Address</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Door/Flat number, Building name, Street, Landmark"
                  className="w-full bg-[#2a2118] border border-[#66502d] rounded-xl p-3 text-xs sm:text-sm text-[#f7f1e6] placeholder-[#6d8a76] focus:outline-none focus:border-[#e0b568]"
                />
              </div>

              <div>
                <label
                  htmlFor="special-instructions-input"
                  className="block text-xs font-semibold !text-black mb-1 flex items-center justify-between"
                >
                  <span>Special Instructions (Optional)</span>
                </label>
                <textarea
                  id="special-instructions-input"
                  rows={2}
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Type your special request here..."
                  className="w-full bg-[#2a2118] border border-[#66502d] rounded-xl p-3 text-xs sm:text-sm text-[#f7f1e6] placeholder-[#6d8a76] focus:outline-none focus:border-[#e0b568]"
                />
              </div>

              {/* Delivery Charge Rule Breakdown Card */}
              <div className="bg-[#10301e] border border-[#66502d] rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[#ddd4c7]">
                  <span>Food Total</span>
                  <span className="font-mono font-bold text-sm">₹{foodTotal}</span>
                </div>

                <div className="flex items-center justify-between text-[#ddd4c7]">
                  <div className="flex items-center gap-1">
                    <span>Delivery Charge</span>
                    <span className="text-[10px] text-[#e0b568] bg-[#1a442a] px-1.5 py-0.2 rounded font-mono">
                      {distanceKm} km
                    </span>
                  </div>
                  <span className="font-mono font-bold text-sm">
                    {deliveryCharge === 0 ? (
                      <span className="text-emerald-400">FREE</span>
                    ) : (
                      `₹${deliveryCharge}`
                    )}
                  </span>
                </div>

                {/* Formula Explanation */}
                <div className="p-2 bg-[#18130e] rounded-lg text-[10px] text-[#9bb5a4] space-y-0.5 border border-[#4a3924]">
                  <div className="text-[#e0b568] font-semibold">Delivery Pricing Policy:</div>
                  <div>• First 2 km: <strong>FREE DELIVERY</strong></div>
                  <div>
                    • After 2 km: <strong>₹50</strong> per additional started km
                  </div>
                  {extraKm > 0 && (
                    <div className="text-[#e0b568] font-mono pt-1">
                      Distance: {distanceKm} km (2 km free + {extraKm.toFixed(1)} km extra = {startedExtraKm} started km × ₹50 = ₹{deliveryCharge})
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-[#1e492f] flex items-center justify-between text-sm sm:text-base font-bold text-[#f7f1e6]">
                  <span>Grand Total</span>
                  <span className="font-mono text-[#e0b568] text-lg">₹{grandTotal}</span>
                </div>
              </div>

              {/* Restaurant Closed Warning */}
              {!isRestaurantOpen && (
                <div className="p-3.5 bg-red-950/90 border-2 border-red-500 rounded-xl text-xs text-red-200 flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-white font-bold uppercase tracking-wide">
                      RESTAURANT CLOSED FOR ORDERS
                    </strong>
                    Hotel Malabar is currently closed. Operating Hours:{' '}
                    <span className="font-mono text-white font-bold">
                      {deliverySettings.openingTime || '07:00'} - {deliverySettings.closingTime || '22:00'}
                    </span>{' '}
                    (IST). Checkout is paused until the restaurant reopens.
                  </div>
                </div>
              )}

              {/* Out of Stock Warning */}
              {hasOutOfStock && (
                <div className="p-3.5 bg-red-950/90 border-2 border-red-500 rounded-xl text-xs text-red-200 flex items-start gap-2.5 shadow-md">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-white font-bold uppercase tracking-wide">
                      OUT OF STOCK ITEMS IN CART
                    </strong>
                    <span>
                      {outOfStockItems.map((ci) => `"${ci.menuItem.name}"`).join(', ')}{' '}
                      {outOfStockItems.length > 1 ? 'are' : 'is'} currently out of stock. Please remove{' '}
                      {outOfStockItems.length > 1 ? 'them' : 'it'} to place your order.
                    </span>
                  </div>
                </div>
              )}

              {/* Minimum Order Check Warning */}
              {!isMinOrderMet && (
                <div className="p-3 bg-amber-950/80 border border-amber-800/80 rounded-xl text-xs text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-amber-300">Minimum Food Order ₹{deliverySettings.minOrderAmount}</strong>
                    Please add ₹{amountNeededForMin} more of food items to enable ordering.
                  </div>
                </div>
              )}

              {/* CASH ON DELIVERY ONLY BADGE */}
              <div className="p-3.5 bg-gradient-to-r from-[#2a2118] to-[#4f3d25] border-2 border-[#e0b568]/60 rounded-xl flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#e0b568] text-[#18130e] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#e0b568] uppercase tracking-wider">
                    Payment Method: Cash on Delivery Only
                  </div>
                  <div className="text-[11px] text-[#ddd4c7]">
                    Pay cash directly to the delivery personnel upon food arrival. No online prepayment required.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        {cartItems.length > 0 && (
          <div className="p-4 border-t border-[#5b4728] bg-[#211c16] sticky bottom-0 z-10 space-y-2">
            <button
              id="proceed-checkout-btn"
              disabled={!isMinOrderMet || !isRestaurantOpen || hasOutOfStock}
              onClick={handleProceedToConfirm}
              className={`w-full font-bold text-sm sm:text-base py-3.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 min-h-[44px] ${
                !isRestaurantOpen
                  ? 'bg-red-950/80 text-red-300 border border-red-800 cursor-not-allowed'
                  : hasOutOfStock
                  ? 'bg-red-950/70 border border-red-700 text-red-300 cursor-not-allowed opacity-90'
                  : !isMinOrderMet
                  ? 'bg-[#2a2118] text-stone-400 border border-[#66502d] cursor-not-allowed opacity-60'
                  : 'bg-gradient-to-r from-[#e0b568] to-[#b98b43] hover:from-[#e8c560] hover:to-[#d7b23d] text-[#18130e] cursor-pointer'
              }`}
            >
              <span>
                {!isRestaurantOpen
                  ? 'RESTAURANT CLOSED (Orders Disabled)'
                  : hasOutOfStock
                  ? 'REMOVE OUT-OF-STOCK ITEMS TO PROCEED'
                  : `Review Order & Place (₹${grandTotal})`}
              </span>
              {isRestaurantOpen && !hasOutOfStock && isMinOrderMet && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        )}

        {/* ORDER CONFIRMATION MODAL */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-[#211c16] border-2 border-[#e0b568] rounded-2xl p-6 text-[#f7f1e6] shadow-2xl space-y-4">
              <div className="text-center pb-2 border-b border-[#5b4728]">
                <span className="font-brand text-xl font-bold text-[#f7f1e6] block">
                  Confirm Hotel Malabar Order
                </span>
                <span className="text-xs text-[#e0b568]">Cash on Delivery</span>
              </div>

              <div className="text-xs space-y-2 bg-[#17130f] p-3 rounded-xl border border-[#5b4728]">
                <div className="flex justify-between">
                  <span className="text-[#a99d8e]">Customer:</span>
                  <span className="font-semibold text-[#f7f1e6]">{user.firstName} {user.lastName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a99d8e]">Phone:</span>
                  <span className="font-mono text-[#e0b568]">{user.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a99d8e]">Delivery Area:</span>
                  <span>{selectedAreaName} ({distanceKm} km)</span>
                </div>
                <div>
                  <span className="text-[#a99d8e] block mb-0.5">Address:</span>
                  <span className="text-[#f7f1e6] block bg-[#2a2118] p-2 rounded border border-[#1f4e30]">
                    {address}
                  </span>
                </div>
                <div>
                  <span className="text-[#a99d8e] block mb-0.5">Special Instructions:</span>
                  <span className={`block p-2 rounded border text-xs ${
                    specialInstructions.trim()
                      ? 'text-[#e0b568] bg-[#2a2118] border-[#66502d] font-medium'
                      : 'text-[#a99d8e] bg-[#0c2417] border-[#5b4728] italic'
                  }`}>
                    {specialInstructions.trim() || 'No special instructions'}
                  </span>
                </div>
                <div className="pt-1">
                  {gpsCoords ? (
                    <div className="flex justify-between items-center bg-[#0d281a] p-2 rounded border border-emerald-600/50 text-[11px]">
                      <span className="text-emerald-300 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>GPS Pin Attached:</span>
                      </span>
                      <span className="font-mono text-[#f7f1e6]">
                        {gpsCoords.latitude.toFixed(5)}, {gpsCoords.longitude.toFixed(5)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center bg-[#2a2118] p-1.5 rounded text-[11px] text-[#a99d8e]">
                      <span>GPS Pin:</span>
                      <span>Not attached</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Items summary */}
              <div className="max-h-36 overflow-y-auto space-y-1.5 text-xs pr-1">
                {cartItems.map((ci) => (
                  <div key={ci.menuItem.id} className="flex justify-between text-[#ddd4c7]">
                    <span>{ci.quantity}x {ci.menuItem.name}</span>
                    <span className="font-mono">₹{ci.menuItem.price * ci.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-[#5b4728] pt-2 space-y-1 text-xs">
                <div className="flex justify-between text-[#a99d8e]">
                  <span>Food Total:</span>
                  <span className="font-mono">₹{foodTotal}</span>
                </div>
                <div className="flex justify-between text-[#a99d8e]">
                  <span>Delivery Fee ({distanceKm} km):</span>
                  <span className="font-mono">
                    {deliveryCharge === 0 ? 'FREE' : `₹${deliveryCharge}`}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold text-[#e0b568] pt-1 border-t border-[#5b4728]">
                  <span>Grand Total (COD):</span>
                  <span className="font-mono">₹{grandTotal}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 bg-[#2a2118] hover:bg-[#4f3d25] text-[#ddd4c7] py-3 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Edit Order
                </button>
                <button
                  type="button"
                  id="confirm-place-order-btn"
                  disabled={isSubmitting}
                  onClick={handlePlaceOrder}
                  className="flex-1 bg-gradient-to-r from-[#e0b568] to-[#b98b43] text-[#18130e] font-bold py-3 rounded-xl text-xs shadow hover:from-[#e8c560] cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting Order...' : 'Confirm Order (COD)'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
