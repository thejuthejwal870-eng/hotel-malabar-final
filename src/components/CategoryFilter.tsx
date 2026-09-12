import React, { memo } from 'react';
import { MenuCategory } from '../types';

interface CategoryFilterProps {
  categories: MenuCategory[];
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
  categoryCounts: Record<string, number>;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = memo(({
  categories,
  selectedCategoryId,
  onSelectCategory,
  categoryCounts,
}) => {
  return (
    <div className="w-full bg-[#0d2819] border-b border-[#1b432a] py-3 sticky top-[108px] sm:top-[68px] z-30 shadow-md">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-[#235836] no-scrollbar">
          {/* All button */}
          <button
            onClick={() => onSelectCategory('all')}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              selectedCategoryId === 'all'
                ? 'bg-[#dfb64c] text-[#0a1f13] shadow'
                : 'bg-[#123620] text-[#c9dcce] hover:bg-[#184428] border border-[#245937]'
            }`}
          >
            <span>All Menu</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                selectedCategoryId === 'all' ? 'bg-[#0a1f13] text-[#dfb64c]' : 'bg-[#0a1f13]/60 text-[#9bb5a4]'
              }`}
            >
              {Object.values(categoryCounts).reduce((a: number, b: number) => a + b, 0)}
            </span>
          </button>

          {/* Categories */}
          {categories.map((cat) => {
            const count = categoryCounts[cat.id] || 0;
            const isSelected = selectedCategoryId === cat.id;
            const isClosed = cat.isActive === false;

            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? isClosed
                      ? 'bg-amber-700 text-amber-100 shadow'
                      : 'bg-[#dfb64c] text-[#0a1f13] shadow'
                    : isClosed
                    ? 'bg-[#181a18] text-amber-400/80 hover:bg-[#222622] border border-amber-800/40'
                    : 'bg-[#123620] text-[#c9dcce] hover:bg-[#184428] border border-[#245937]'
                }`}
              >
                <span>{cat.name}</span>
                {isClosed ? (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-950 text-amber-300 font-bold border border-amber-800">
                    Closed
                  </span>
                ) : count > 0 ? (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected ? 'bg-[#0a1f13] text-[#dfb64c]' : 'bg-[#0a1f13]/60 text-[#9bb5a4]'
                    }`}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
