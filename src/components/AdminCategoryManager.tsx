import React, { useState } from 'react';
import { Layers, Plus, Edit2, Trash2, ArrowUp, ArrowDown, CheckCircle2, Upload, AlertCircle, Utensils, Flame, Fish, Soup, Salad, Drumstick, Carrot, Egg, Disc, Wheat, Sparkles, Sun, Coffee, X } from 'lucide-react';
import { MenuCategory, MenuItem } from '../types';

const CATEGORY_ICON_OPTIONS = [
  { name: 'Utensils', icon: Utensils, label: 'Cutlery' }, { name: 'Flame', icon: Flame, label: 'Biryani / Tandoor' },
  { name: 'Drumstick', icon: Drumstick, label: 'Chicken / Mutton' }, { name: 'Fish', icon: Fish, label: 'Coastal Seafood' },
  { name: 'Disc', icon: Disc, label: 'Kerala Porotta' }, { name: 'Wheat', icon: Wheat, label: 'Breads & Rice' },
  { name: 'Soup', icon: Soup, label: 'Gravies & Curries' }, { name: 'Egg', icon: Egg, label: 'Egg Delicacies' },
  { name: 'Salad', icon: Salad, label: 'Veg & Salads' }, { name: 'Carrot', icon: Carrot, label: 'Vegetarian' },
  { name: 'Sun', icon: Sun, label: 'Breakfast / Appam' }, { name: 'Coffee', icon: Coffee, label: 'Sulaimani / Beverages' },
  { name: 'Sparkles', icon: Sparkles, label: 'Chef Specials' },
];

export const getCategoryIconComponent = (iconName?: string) => CATEGORY_ICON_OPTIONS.find(o => o.name.toLowerCase() === (iconName || '').toLowerCase())?.icon || Utensils;

interface AdminCategoryManagerProps { adminToken: string; categories: MenuCategory[]; menuItems: MenuItem[]; onCategoriesChanged: () => void; }

export const AdminCategoryManager: React.FC<AdminCategoryManagerProps> = ({ adminToken, categories, menuItems, onCategoriesChanged }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryIcon, setCategoryIcon] = useState('Utensils');
  const [categoryImageUrl, setCategoryImageUrl] = useState('');
  const [categoryPhotoUploading, setCategoryPhotoUploading] = useState(false);
  const categoryPhotoInputRef = React.useRef<HTMLInputElement>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteModalCat, setDeleteModalCat] = useState<MenuCategory | null>(null);
  const [reassignToCatId, setReassignToCatId] = useState('');

  const itemCounts: Record<string, number> = {};
  menuItems.forEach(item => { itemCounts[item.categoryId] = (itemCounts[item.categoryId] || 0) + 1; });
  const notify = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 3000); };

  const handleOpenAddModal = () => { setEditingCategory(null); setCategoryName(''); setCategoryIcon('Utensils'); setCategoryImageUrl(''); setErrorMsg(null); setModalOpen(true); };
  const handleOpenEditModal = (cat: MenuCategory) => { setEditingCategory(cat); setCategoryName(cat.name); setCategoryIcon(cat.icon || 'Utensils'); setCategoryImageUrl(cat.imageUrl || ''); setErrorMsg(null); setModalOpen(true); };

  // Category photos are resized in the browser and stored with the cloud-backed menu data.
  const handleCategoryPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select an image file.');
      e.target.value = '';
      return;
    }
    setCategoryPhotoUploading(true);
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = () => {
      const source = new Image();
      source.onload = () => {
        const maxSide = 1200;
        const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(source.width * scale));
        canvas.height = Math.max(1, Math.round(source.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setCategoryPhotoUploading(false);
          setErrorMsg('Could not process the selected photo.');
          return;
        }
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setCategoryImageUrl(dataUrl);
        setCategoryPhotoUploading(false);
      };
      source.onerror = () => {
        setCategoryPhotoUploading(false);
        setErrorMsg('Could not read the selected photo.');
      };
      source.src = String(reader.result);
    };
    reader.onerror = () => {
      setCategoryPhotoUploading(false);
      setErrorMsg('Could not read the selected photo.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault(); if (!categoryName.trim() || !adminToken) return;
    setActionLoading(true); setErrorMsg(null);
    try {
      const payload = { name: categoryName.trim(), icon: categoryIcon, imageUrl: categoryImageUrl.trim() };
      const url = editingCategory ? `/api/admin/menu/categories/${editingCategory.id}` : '/api/admin/menu/categories';
      const res = await fetch(url, { method: editingCategory ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }, body: JSON.stringify(payload) });
      if (!res.ok) { const body = await res.json().catch(() => null); throw new Error(body?.error || 'Failed to save category'); }
      setModalOpen(false); onCategoriesChanged(); notify(`Category "${categoryName.trim()}" ${editingCategory ? 'updated' : 'created'} successfully.`);
    } catch (err: any) { setErrorMsg(err.message || 'Action failed'); } finally { setActionLoading(false); }
  };

  const toggleCategory = async (cat: MenuCategory, nextActive: boolean) => {
    if (!adminToken) return;
    try {
      const res = await fetch(`/api/admin/menu/categories/${cat.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ isActive: nextActive }) });
      if (!res.ok) throw new Error('Failed to update category availability');
      onCategoriesChanged(); notify(`Category "${cat.name}" is now ${nextActive ? 'OPEN' : 'CLOSED'}.`);
    } catch (err: any) { setErrorMsg(err.message || 'Failed to update category availability'); }
  };

  const moveCategory = async (id: string, direction: 'up' | 'down') => {
    if (!adminToken) return;
    try {
      const res = await fetch(`/api/admin/menu/categories/${id}/move`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ direction }) });
      if (res.ok) onCategoriesChanged(); else throw new Error('Failed to move category');
    } catch (err: any) { setErrorMsg(err.message || 'Failed to move category'); }
  };

  const promptDelete = (cat: MenuCategory) => { setReassignToCatId(categories.find(c => c.id !== cat.id)?.id || ''); setDeleteModalCat(cat); };
  const confirmDelete = async () => {
    if (!deleteModalCat || !adminToken) return; setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/menu/categories/${deleteModalCat.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ reassignToCategoryId: reassignToCatId || undefined }) });
      if (!res.ok) throw new Error('Failed to delete category');
      const name = deleteModalCat.name; setDeleteModalCat(null); onCategoriesChanged(); notify(`Category "${name}" deleted.`);
    } catch (err: any) { setErrorMsg(err.message || 'Delete failed'); } finally { setActionLoading(false); }
  };

  const sortedCategories = [...categories].sort((a, b) => a.displayOrder - b.displayOrder);
  return <div className="space-y-6 max-w-5xl">
    <div className="pb-3 border-b border-[#1b432a] flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-brand font-bold text-[#fcfaf6] flex items-center gap-2"><Layers className="w-5 h-5 text-[#dfb64c]" /><span>Menu Categories & Ordering ({categories.length})</span></h2><p className="text-xs text-[#8ea896]">Create, rename, reorder, set category photos, or delete food categories. Changes appear on the customer website.</p></div>
      <button onClick={handleOpenAddModal} className="bg-gradient-to-r from-[#dfb64c] to-[#cba135] text-[#0a1f13] font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg cursor-pointer"><Plus className="w-4 h-4" />Create New Category</button>
    </div>
    {successMsg && <div className="bg-emerald-950/80 border border-emerald-500/80 text-emerald-200 text-xs px-4 py-3 rounded-xl flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" />{successMsg}</div>}
    {errorMsg && <div className="bg-red-950/80 border border-red-500/80 text-red-200 text-xs px-4 py-3 rounded-xl flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-400" />{errorMsg}</div>}
    <div className="bg-[#0f2d1c] border border-[#235836] rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="text-xs text-[#8ea896] pb-2 border-b border-[#1c472d] flex items-center justify-between"><span>CATEGORY & PHOTO</span><span>STATUS & ACTIONS</span></div>
      <div className="space-y-2">{sortedCategories.map((cat, index) => {
        const Icon = getCategoryIconComponent(cat.icon); const count = itemCounts[cat.id] || 0;
        return <div key={cat.id} className="flex items-center justify-between gap-3 bg-[#113320] p-3 rounded-xl border border-[#1b432a] text-xs">
          <div className="flex items-center gap-3 min-w-0"><span className="w-6 h-6 shrink-0 rounded-lg bg-[#081a10] border border-[#245937] text-[11px] font-mono text-[#dfb64c] flex items-center justify-center font-bold">{index + 1}</span><div className="w-12 h-12 shrink-0 rounded-xl overflow-hidden bg-[#143d26] border border-[#2b6540] flex items-center justify-center text-[#dfb64c]">{cat.imageUrl ? <img src={cat.imageUrl} alt="" className="w-full h-full object-cover" /> : <Icon className="w-5 h-5" />}</div><div className="min-w-0"><h4 className="font-semibold text-[#fcfaf6] text-sm truncate">{cat.name}</h4><span className="text-[11px] text-[#8ea896]">{count} {count === 1 ? 'dish' : 'dishes'} in category</span></div></div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0"><div className="flex items-center rounded-lg border border-[#245937] p-0.5 bg-[#0a1f13]"><button type="button" onClick={() => toggleCategory(cat, true)} className={`px-2 py-1 rounded-md text-[11px] font-bold ${cat.isActive !== false ? 'bg-emerald-600 text-white' : 'text-stone-400'}`}>OPEN</button><button type="button" onClick={() => toggleCategory(cat, false)} className={`px-2 py-1 rounded-md text-[11px] font-bold ${cat.isActive === false ? 'bg-red-600 text-white' : 'text-stone-400'}`}>CLOSED</button></div><button onClick={() => moveCategory(cat.id, 'up')} disabled={index === 0} className="p-1.5 rounded-lg border bg-[#143d26] border-[#255e39] text-[#dfb64c] disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button><button onClick={() => moveCategory(cat.id, 'down')} disabled={index === sortedCategories.length - 1} className="p-1.5 rounded-lg border bg-[#143d26] border-[#255e39] text-[#dfb64c] disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button><button onClick={() => handleOpenEditModal(cat)} className="p-1.5 bg-[#143d26] text-[#dfb64c] border border-[#255e39] rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button><button onClick={() => promptDelete(cat)} className="p-1.5 bg-red-950/80 text-red-400 border border-red-800/80 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button></div>
        </div>;
      })}</div>
    </div>
    {modalOpen && <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-[#0f2d1c] border border-[#235836] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"><div className="flex items-center justify-between border-b border-[#1c472d] pb-3"><h3 className="text-base font-bold text-[#fcfaf6]">{editingCategory ? 'Rename / Edit Category' : 'Create New Menu Category'}</h3><button onClick={() => setModalOpen(false)} className="text-[#8ea896]"><X className="w-5 h-5" /></button></div><form onSubmit={handleSaveCategory} className="space-y-4">
      <div><label className="block text-xs font-semibold text-[#c9dcce] mb-1">Category Name</label><input required value={categoryName} onChange={e => setCategoryName(e.target.value)} placeholder="e.g. Biryani, Seafood, Breakfast" className="w-full bg-[#123620] border border-[#245937] rounded-xl px-3 py-2.5 text-sm text-[#fcfaf6] focus:outline-none focus:border-[#dfb64c]" /></div>
      <div>
        <label className="block text-xs font-semibold text-[#c9dcce] mb-1">Category Photo</label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => categoryPhotoInputRef.current?.click()} disabled={categoryPhotoUploading} className="px-3 py-2 rounded-xl bg-[#184428] border border-[#dfb64c] text-[#dfb64c] text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
            <Upload className="w-4 h-4" />{categoryPhotoUploading ? 'Processing...' : 'Add / Upload Photo'}
          </button>
          <input ref={categoryPhotoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCategoryPhotoUpload} />
          {categoryImageUrl && <button type="button" onClick={() => setCategoryImageUrl('')} className="px-3 py-2 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs font-semibold">Remove Photo</button>}
        </div>
        <div className="mt-2">
          <label className="block text-[10px] text-[#8ea896] mb-1">Or paste an image URL (optional)</label>
          <input type="url" value={categoryImageUrl.startsWith('data:') ? '' : categoryImageUrl} onChange={e => setCategoryImageUrl(e.target.value)} placeholder="https://..." className="w-full bg-[#123620] border border-[#245937] rounded-xl px-3 py-2.5 text-sm text-[#fcfaf6] focus:outline-none focus:border-[#dfb64c]" />
        </div>
        <p className="text-[10px] text-[#8ea896] mt-1">Upload from phone/gallery or paste a URL. The uploaded photo is resized and saved with the category, then appears in the customer category circle.</p>
        {categoryImageUrl && <div className="mt-3 w-24 h-24 rounded-full overflow-hidden border-2 border-[#dfb64c] bg-[#143d26]"><img src={categoryImageUrl} alt="Category preview" className="w-full h-full object-cover" /></div>}
      </div>
      <div><label className="block text-xs font-semibold text-[#c9dcce] mb-2">Select Visual Icon (fallback)</label><div className="grid grid-cols-4 gap-2">{CATEGORY_ICON_OPTIONS.map(opt => { const I = opt.icon; const selected = categoryIcon.toLowerCase() === opt.name.toLowerCase(); return <button type="button" key={opt.name} onClick={() => setCategoryIcon(opt.name)} className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 ${selected ? 'bg-[#184428] border-[#dfb64c] text-[#dfb64c]' : 'bg-[#113320] border-[#1b432a] text-[#8ea896]'}`}><I className="w-4 h-4" /><span className="text-[9px] truncate max-w-full">{opt.label}</span></button>; })}</div></div>
      <div className="flex justify-end gap-3 pt-3 border-t border-[#1c472d]"><button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs text-[#8ea896]">Cancel</button><button type="submit" disabled={actionLoading} className="bg-gradient-to-r from-[#dfb64c] to-[#cba135] text-[#0a1f13] font-bold px-5 py-2 rounded-xl text-xs disabled:opacity-50">{actionLoading ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}</button></div>
    </form></div></div>}
    {deleteModalCat && <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-[#0f2d1c] border border-red-800/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"><div className="flex items-center gap-3 text-red-400"><Trash2 className="w-6 h-6" /><div><h3 className="text-base font-bold text-red-200">Delete Category</h3><p className="text-xs text-red-400/80">Are you sure you want to delete “{deleteModalCat.name}”?</p></div></div>{(itemCounts[deleteModalCat.id] || 0) > 0 && <div className="space-y-3 bg-[#17251c] p-3 rounded-xl border border-[#294c35]"><p className="text-xs text-[#dfb64c]">This category contains <strong>{itemCounts[deleteModalCat.id]} food items</strong>. Reassign them to:</p><select value={reassignToCatId} onChange={e => setReassignToCatId(e.target.value)} className="w-full bg-[#123620] border border-[#245937] rounded-xl px-3 py-2 text-xs text-[#fcfaf6]">{categories.filter(c => c.id !== deleteModalCat.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}<div className="flex justify-end gap-3"><button onClick={() => setDeleteModalCat(null)} className="px-4 py-2 text-xs text-[#8ea896]">Cancel</button><button onClick={confirmDelete} disabled={actionLoading} className="bg-red-700 text-white font-bold px-5 py-2 rounded-xl text-xs">{actionLoading ? 'Deleting...' : 'Confirm Delete'}</button></div></div></div>}
  </div>;
};
