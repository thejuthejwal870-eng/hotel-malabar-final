import React, { memo } from 'react';
import { MenuCategory } from '../types';

interface CategoryFilterProps {
  categories: MenuCategory[];
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
  categoryCounts: Record<string, number>;
}

const categoryImageByName: Record<string, string> = {
  biryani: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=180&q=80',
  tandoori: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=180&q=80',
  shawarma: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=180&q=80',
  chinese: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=180&q=80',
  breakfast: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=180&q=80',
  meals: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=180&q=80',
};

export const CategoryFilter: React.FC<CategoryFilterProps> = memo(({
  categories,
  selectedCategoryId,
  onSelectCategory,
  categoryCounts,
}) => {
  return (
    <div className="hm-category-strip w-full bg-[#fbf8f0] border-b border-[#d9cfbb] sticky top-[108px] sm:top-[68px] z-30 shadow-sm">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5">
        <div className="flex items-center gap-3 overflow-x-auto pb-0.5 no-scrollbar">
          <button
            onClick={() => onSelectCategory('all')}
            className={`hm-category-chip shrink-0 flex flex-col items-center gap-1 min-w-[58px] ${selectedCategoryId === 'all' ? 'is-active' : ''}`}
            aria-label="All menu"
          >
            <span className="hm-category-avatar">ALL</span>
            <span className="hm-category-name">All</span>
          </button>

          {categories.map((cat) => {
            const count = categoryCounts[cat.id] || 0;
            const isSelected = selectedCategoryId === cat.id;
            const isClosed = cat.isActive === false;
            const image = categoryImageByName[cat.name.trim().toLowerCase()];

            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                disabled={isClosed}
                className={`hm-category-chip shrink-0 flex flex-col items-center gap-1 min-w-[64px] ${isSelected ? 'is-active' : ''} ${isClosed ? 'is-closed' : ''}`}
                aria-label={`${cat.name}${count ? `, ${count} dishes` : ''}`}
              >
                <span className="hm-category-avatar">
                  {image ? <img src={image} alt="" className="w-full h-full object-cover" /> : <span>{cat.name.slice(0, 2).toUpperCase()}</span>}
                  {isClosed && <span className="hm-category-closed">OFF</span>}
                </span>
                <span className="hm-category-name">{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
