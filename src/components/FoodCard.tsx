import React from 'react';
import { Plus, Minus, Clock, Flame, Leaf } from 'lucide-react';
import { MenuItem } from '../types';
import { WatermarkedImage } from './WatermarkedImage';

interface FoodCardProps {
  item: MenuItem;
  categoryName?: string;
  cartQuantity: number;
  isRestaurantOpen?: boolean;
  isCategoryOpen?: boolean;
  onAddToCart: (item: MenuItem) => void;
  onUpdateQuantity: (itemId: string, delta: number) => void;
}

export const FoodCard: React.FC<FoodCardProps> = ({
  item,
  categoryName,
  cartQuantity,
  isRestaurantOpen = true,
  isCategoryOpen = true,
  onAddToCart,
  onUpdateQuantity,
}) => {
  // Determine distinct status per specification:
  // A. Restaurant Closed -> Entire restaurant ordering disabled
  // B. Category Closed -> Only category unavailable
  // C. Item Out of Stock -> Only item out of stock
  const restaurantClosed = isRestaurantOpen === false;
  const categoryClosed = !restaurantClosed && isCategoryOpen === false;
  const itemOutOfStock = !restaurantClosed && !categoryClosed && !item.isAvailable;
  const canOrder = !restaurantClosed && !categoryClosed && item.isAvailable;

  return (
    <div
      id={`food-card-${item.id}`}
      className={`bg-[#0f2a1b] border ${
        cartQuantity > 0 ? 'border-[#dfb64c]' : 'border-[#1f4a2e]'
      } rounded-2xl overflow-hidden shadow-lg transition-all duration-300 hover:border-[#dfb64c]/70 hover:shadow-2xl flex flex-col justify-between`}
    >
      {/* Food Image with Watermark */}
      <div className="relative aspect-[4/3] w-full bg-[#081a10]">
        <WatermarkedImage
          src={item.imageUrl}
          alt={`Hotel Malabar ${item.name}`}
          className="w-full h-full"
          watermarkSize="sm"
        />

        {/* Veg / Non-Veg Indicator Badge */}
        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5">
          <div
            className={`w-5 h-5 rounded-md flex items-center justify-center border shadow-sm ${
              item.isVeg
                ? 'bg-emerald-950 border-emerald-500 text-emerald-400'
                : 'bg-red-950 border-red-500 text-red-400'
            }`}
            title={item.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
          >
            {item.isVeg ? (
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            ) : (
              <div className="w-2 h-2 rotate-45 bg-red-400" />
            )}
          </div>

          {categoryName && (
            <span className="bg-[#0a1f13]/85 backdrop-blur-md text-[#e0d6be] border border-[#214f34] text-[10px] font-medium px-2 py-0.5 rounded-md shadow-sm">
              {categoryName}
            </span>
          )}
        </div>

        {/* Prep Time Tag */}
        <div className="absolute top-2.5 right-2.5 z-10 bg-[#0a1f13]/85 backdrop-blur-md text-[#dfb64c] border border-[#cba135]/40 text-[10px] font-mono font-medium px-2 py-0.5 rounded-md shadow-sm flex items-center gap-1">
          <Clock className="w-3 h-3 text-[#dfb64c]" />
          <span>{item.prepTimeMinutes || 10}m</span>
        </div>

        {/* Overlays for Closed Restaurant, Closed Category, or Out of Stock */}
        {restaurantClosed && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-[1px] z-20 flex flex-col items-center justify-center p-3 text-center">
            <span className="text-red-300 font-bold text-xs uppercase tracking-wider bg-red-950/90 px-2.5 py-1 rounded-lg border border-red-800">
              RESTAURANT CLOSED
            </span>
          </div>
        )}

        {categoryClosed && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-[1px] z-20 flex flex-col items-center justify-center p-3 text-center">
            <span className="text-amber-300 font-bold text-xs uppercase tracking-wider bg-amber-950/90 px-2.5 py-1 rounded-lg border border-amber-800">
              CURRENTLY UNAVAILABLE
            </span>
          </div>
        )}

        {itemOutOfStock && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-[1px] z-20 flex flex-col items-center justify-center p-3 text-center">
            <span className="text-red-300 font-bold text-xs uppercase tracking-wider bg-red-950/90 px-2.5 py-1 rounded-lg border border-red-800">
              OUT OF STOCK
            </span>
          </div>
        )}
      </div>

      {/* Item Details */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="font-semibold text-base sm:text-lg text-[#fcfaf6] leading-snug">
              {item.name}
            </h3>
            <div className="text-right shrink-0">
              <span className="font-bold text-base sm:text-lg text-[#dfb64c] font-mono">
                ₹{item.price}
              </span>
            </div>
          </div>

          <p className="text-xs text-[#a3bfae] line-clamp-2 leading-relaxed mb-4">
            {item.description}
          </p>
        </div>

        {/* Add To Cart Controls (Touch-friendly minimum 44px target) */}
        <div className="pt-2 border-t border-[#183e25] flex items-center justify-between">
          <span className="text-[11px] text-[#7d9e89]">
            {item.isVeg ? 'Veg Specialty' : 'Halal & Fresh'}
          </span>

          {canOrder ? (
            cartQuantity > 0 ? (
              <div className="flex items-center gap-2 bg-[#123620] border border-[#dfb64c] rounded-xl p-1 shadow-sm">
                <button
                  onClick={() => onUpdateQuantity(item.id, -1)}
                  className="w-8 h-8 rounded-lg bg-[#1a472c] hover:bg-[#225c38] text-[#fdfbf7] flex items-center justify-center transition-colors cursor-pointer"
                  title="Reduce quantity"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono font-bold text-sm text-[#dfb64c] min-w-[20px] text-center">
                  {cartQuantity}
                </span>
                <button
                  onClick={() => onUpdateQuantity(item.id, 1)}
                  className="w-8 h-8 rounded-lg bg-[#dfb64c] hover:bg-[#ebce6b] text-[#0a1f13] flex items-center justify-center transition-colors cursor-pointer font-bold"
                  title="Increase quantity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                id={`add-to-cart-${item.id}`}
                onClick={() => onAddToCart(item)}
                className="bg-gradient-to-r from-[#dfb64c] to-[#cba135] hover:from-[#e7c35d] hover:to-[#d4af37] text-[#0a1f13] font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px]"
              >
                <Plus className="w-4 h-4" />
                <span>Add to Cart</span>
              </button>
            )
          ) : restaurantClosed ? (
            <button
              disabled
              className="bg-red-950/60 border border-red-800/80 text-red-300 font-bold text-xs px-3.5 py-2.5 rounded-xl cursor-not-allowed opacity-80 min-h-[44px]"
            >
              RESTAURANT CLOSED
            </button>
          ) : categoryClosed ? (
            <button
              disabled
              className="bg-amber-950/60 border border-amber-800/80 text-amber-300 font-bold text-xs px-3.5 py-2.5 rounded-xl cursor-not-allowed opacity-80 min-h-[44px]"
            >
              CURRENTLY UNAVAILABLE
            </button>
          ) : (
            <button
              disabled
              className="bg-red-950/60 border border-red-800/80 text-red-300 font-bold text-xs px-3.5 py-2.5 rounded-xl cursor-not-allowed opacity-80 min-h-[44px]"
            >
              OUT OF STOCK
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
