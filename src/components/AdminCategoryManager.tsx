import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  Utensils,
  Flame,
  Fish,
  Soup,
  Salad,
  Drumstick,
  Carrot,
  Egg,
  Disc,
  Wheat,
  Sparkles,
  Sun,
  Coffee,
  X,
} from 'lucide-react';
import { MenuCategory, MenuItem } from '../types';

const CATEGORY_ICON_OPTIONS = [
  { name: 'Utensils', icon: Utensils, label: 'Cutlery' },
  { name: 'Flame', icon: Flame, label: 'Biryani / Tandoor' },
  { name: 'Drumstick', icon: Drumstick, label: 'Chicken / Mutton' },
  { name: 'Fish', icon: Fish, label: 'Coastal Seafood' },
  { name: 'Disc', icon: Disc, label: 'Kerala Porotta' },
  { name: 'Wheat', icon: Wheat, label: 'Breads & Rice' },
  { name: 'Soup', icon: Soup, label: 'Gravies & Curries' },
  { name: 'Egg', icon: Egg, label: 'Egg Delicacies' },
  { name: 'Salad', icon: Salad, label: 'Veg & Salads' },
  { name: 'Carrot', icon: Carrot, label: 'Vegetarian' },
  { name: 'Sun', icon: Sun, label: 'Breakfast / Appam' },
  { name: 'Coffee', icon: Coffee, label: 'Sulaimani / Beverages' },
  { name: 'Sparkles', icon: Sparkles, label: 'Chef Specials' },
];

export const getCategoryIconComponent = (iconName?: string) => {
  const found = CATEGORY_ICON_OPTIONS.find((o) => o.name.toLowerCase() === (iconName || '').toLowerCase());
  return found ? found.icon : Utensils;
};

interface AdminCategoryManagerProps {
  adminToken: string;
  categories: MenuCategory[];
  menuItems: MenuItem[];
  onCategoriesChanged: () => void;
}

export const AdminCategoryManager: React.FC<AdminCategoryManagerProps> = ({
  adminToken,
  categories,
  menuItems,
  onCategoriesChanged,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryIcon, setCategoryIcon] = useState('Utensils');
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Delete modal state
  const [deleteModalCat, setDeleteModalCat] = useState<MenuCategory | null>(null);
  const [reassignToCatId, setReassignToCatId] = useState<string>('');

  // Calculate item counts per category
  const itemCounts: Record<string, number> = {};
  menuItems.forEach((item) => {
    itemCounts[item.categoryId] = (itemCounts[item.categoryId] || 0) + 1;
  });

  const handleOpenAddModal = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryIcon('Utensils');
    setModalOpen(true);
  };

  const handleOpenEditModal = (cat: MenuCategory) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategoryIcon(cat.icon || 'Utensils');
    setModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim() || !adminToken) return;

    setActionLoading(true);
    setErrorMsg(null);
    try {
      if (editingCategory) {
        // Update category
        const res = await fetch(`/api/admin/menu/categories/${editingCategory.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            name: categoryName.trim(),
            icon: categoryIcon,
          }),
        });
        if (!res.ok) throw new Error('Failed to update category');
        setSuccessMsg(`Category "${categoryName}" updated successfully.`);
      } else {
        // Create category
        const res = await fetch('/api/admin/menu/categories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            name: categoryName.trim(),
            icon: categoryIcon,
          }),
        });
        if (!res.ok) throw new Error('Failed to create category');
        setSuccessMsg(`Category "${categoryName}" created successfully.`);
      }

      setModalOpen(false);
      onCategoriesChanged();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleCategoryAvailability = async (cat: MenuCategory, nextActive: boolean) => {
    if (!adminToken) return;
    try {
      const res = await fetch(`/api/admin/menu/categories/${cat.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ isActive: nextActive }),
      });
      if (res.ok) {
        onCategoriesChanged();
        setSuccessMsg(`Category "${cat.name}" is now ${nextActive ? 'OPEN' : 'CLOSED'}.`);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update category availability');
    }
  };

  const handleMoveCategory = async (id: string, direction: 'up' | 'down') => {
    if (!adminToken) return;
    try {
      const res = await fetch(`/api/admin/menu/categories/${id}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ direction }),
      });
      if (res.ok) {
        onCategoriesChanged();
      }
    } catch (err) {
      console.error('Failed to move category:', err);
    }
  };

  const handleDeletePrompt = (cat: MenuCategory) => {
    const count = itemCounts[cat.id] || 0;
    const otherCats = categories.filter((c) => c.id !== cat.id);
    setReassignToCatId(otherCats[0]?.id || '');
    setDeleteModalCat(cat);
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalCat || !adminToken) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/menu/categories/${deleteModalCat.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          reassignToCategoryId: reassignToCatId || undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to delete category');

      setSuccessMsg(`Category "${deleteModalCat.name}" deleted.`);
      setDeleteModalCat(null);
      onCategoriesChanged();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Delete failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Sort categories by displayOrder
  const sortedCategories = [...categories].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="pb-3 border-b border-[#1b432a] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-brand font-bold text-[#fcfaf6] flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#dfb64c]" />
            <span>Menu Categories & Ordering ({categories.length})</span>
          </h2>
          <p className="text-xs text-[#8ea896]">
            Create, rename, reorder, or delete food categories. Ordering here dictates how categories appear on the customer website.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="bg-gradient-to-r from-[#dfb64c] to-[#cba135] hover:from-[#e7c35d] text-[#0a1f13] font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Category</span>
        </button>
      </div>

      {successMsg && (
        <div className="bg-emerald-950/80 border border-emerald-500/80 text-emerald-200 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-950/80 border border-red-500/80 text-red-200 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Category List Cards */}
      <div className="bg-[#0f2d1c] border border-[#235836] rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="text-xs text-[#8ea896] pb-2 border-b border-[#1c472d] flex items-center justify-between">
          <span>CATEGORY & ICON</span>
          <span>REORDER & ACTIONS</span>
        </div>

        <div className="space-y-2">
          {sortedCategories.map((cat, index) => {
            const IconComponent = getCategoryIconComponent(cat.icon);
            const count = itemCounts[cat.id] || 0;
            const isFirst = index === 0;
            const isLast = index === sortedCategories.length - 1;

            return (
              <div
                key={cat.id}
                className="flex items-center justify-between bg-[#113320] p-3 rounded-xl border border-[#1b432a] text-xs transition-colors hover:border-[#dfb64c]/40"
              >
                {/* Left: Order index badge, Icon, Name, Items count */}
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-[#081a10] border border-[#245937] text-[11px] font-mono text-[#dfb64c] flex items-center justify-center font-bold">
                    {index + 1}
                  </span>

                  <div className="w-8 h-8 rounded-lg bg-[#143d26] border border-[#2b6540] flex items-center justify-center text-[#dfb64c]">
                    <IconComponent className="w-4 h-4" />
                  </div>

                  <div>
                    <h4 className="font-semibold text-[#fcfaf6] text-sm sm:text-base">
                      {cat.name}
                    </h4>
                    <span className="text-[11px] text-[#8ea896]">
                      {count} {count === 1 ? 'dish' : 'dishes'} in category
                    </span>
                  </div>
                </div>

                {/* Right: Availability Toggle (OPEN / CLOSED) + Reorder Up/Down + Edit + Delete */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {/* Category Status Toggle */}
                  <div className="flex items-center rounded-lg border border-[#245937] p-0.5 bg-[#0a1f13] mr-1">
                    <button
                      type="button"
                      onClick={() => handleToggleCategoryAvailability(cat, true)}
                      title="Set Category OPEN for orders"
                      className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all ${
                        cat.isActive !== false
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-stone-400 hover:text-emerald-300'
                      }`}
                    >
                      OPEN
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleCategoryAvailability(cat, false)}
                      title="Set Category CLOSED (Unavailable)"
                      className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all ${
                        cat.isActive === false
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'text-stone-400 hover:text-red-300'
                      }`}
                    >
                      CLOSED
                    </button>
                  </div>

                  <button
                    onClick={() => handleMoveCategory(cat.id, 'up')}
                    disabled={isFirst}
                    title="Move Category Up"
                    className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                      isFirst
                        ? 'opacity-30 border-stone-800 text-stone-600 cursor-not-allowed'
                        : 'bg-[#143d26] border-[#255e39] text-[#dfb64c] hover:bg-[#1e5836]'
                    }`}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleMoveCategory(cat.id, 'down')}
                    disabled={isLast}
                    title="Move Category Down"
                    className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                      isLast
                        ? 'opacity-30 border-stone-800 text-stone-600 cursor-not-allowed'
                        : 'bg-[#143d26] border-[#255e39] text-[#dfb64c] hover:bg-[#1e5836]'
                    }`}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleOpenEditModal(cat)}
                    className="p-1.5 bg-[#143d26] text-[#dfb64c] hover:bg-[#1d5435] border border-[#255e39] rounded-lg cursor-pointer"
                    title="Rename / Edit category"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeletePrompt(cat)}
                    className="p-1.5 bg-red-950/80 text-red-400 hover:bg-red-900 border border-red-800/80 rounded-lg cursor-pointer"
                    title="Delete category"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CREATE / EDIT CATEGORY MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f2d1c] border border-[#235836] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1c472d] pb-3">
              <h3 className="text-base font-bold text-[#fcfaf6]">
                {editingCategory ? 'Rename / Edit Category' : 'Create New Menu Category'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-[#8ea896] hover:text-[#fcfaf6] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#c9dcce] mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  required
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="e.g. Thalassery Biryanis, Porottas, Seafood..."
                  className="w-full bg-[#123620] border border-[#245937] rounded-xl px-3 py-2.5 text-sm text-[#fcfaf6] focus:outline-none focus:border-[#dfb64c]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#c9dcce] mb-2">
                  Select Visual Category Icon
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {CATEGORY_ICON_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = categoryIcon.toLowerCase() === opt.name.toLowerCase();
                    return (
                      <button
                        type="button"
                        key={opt.name}
                        onClick={() => setCategoryIcon(opt.name)}
                        className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#184428] border-[#dfb64c] text-[#dfb64c] shadow-md'
                            : 'bg-[#113320] border-[#1b432a] text-[#8ea896] hover:text-[#fcfaf6]'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[9px] truncate max-w-full">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1c472d]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs text-[#8ea896] hover:text-[#fcfaf6] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-gradient-to-r from-[#dfb64c] to-[#cba135] text-[#0a1f13] font-bold px-5 py-2 rounded-xl text-xs shadow cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CATEGORY CONFIRMATION MODAL */}
      {deleteModalCat && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f2d1c] border border-red-800/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <Trash2 className="w-6 h-6 flex-shrink-0" />
              <div>
                <h3 className="text-base font-bold text-red-200">Delete Category</h3>
                <p className="text-xs text-red-400/80">
                  Are you sure you want to delete &ldquo;{deleteModalCat.name}&rdquo;?
                </p>
              </div>
            </div>

            {(itemCounts[deleteModalCat.id] || 0) > 0 ? (
              <div className="space-y-3 bg-[#17251c] p-3 rounded-xl border border-[#294c35]">
                <p className="text-xs text-[#dfb64c]">
                  Notice: This category contains{' '}
                  <strong>{itemCounts[deleteModalCat.id]} food items</strong>. Choose a category to reassign these items to:
                </p>

                <select
                  value={reassignToCatId}
                  onChange={(e) => setReassignToCatId(e.target.value)}
                  className="w-full bg-[#123620] border border-[#245937] rounded-xl px-3 py-2 text-xs text-[#fcfaf6] focus:outline-none focus:border-[#dfb64c]"
                >
                  {categories
                    .filter((c) => c.id !== deleteModalCat.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        Move items to: {c.name}
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <p className="text-xs text-[#8ea896]">
                This category is empty. Deleting it will not affect any menu items.
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalCat(null)}
                className="px-4 py-2 text-xs text-[#8ea896] hover:text-[#fcfaf6] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={actionLoading}
                className="bg-red-700 hover:bg-red-600 text-white font-bold px-5 py-2 rounded-xl text-xs shadow cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
