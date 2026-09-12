import React, { useState, useRef } from 'react';
import {
  Upload,
  Camera,
  Sparkles,
  Check,
  CheckSquare,
  Square,
  Trash2,
  AlertCircle,
  X,
  FileText,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Info,
  Layers,
} from 'lucide-react';
import { MenuCategory, MenuItem } from '../types';

interface MenuCardImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: MenuCategory[];
  adminToken: string;
  onItemsAdded: (addedItems: MenuItem[]) => void;
}

interface DetectedItemDraft {
  id: string; // temporary local id
  name: string;
  categoryId: string;
  price: string; // string so admin can edit or leave blank
  isVeg: boolean;
  description: string;
  selected: boolean;
}

interface UploadedFilePreview {
  file: File;
  previewUrl: string;
  dataBase64?: string;
  mimeType?: string;
}

export const MenuCardImportModal: React.FC<MenuCardImportModalProps> = ({
  isOpen,
  onClose,
  categories,
  adminToken,
  onItemsAdded,
}) => {
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFilePreview[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detectedItems, setDetectedItems] = useState<DetectedItemDraft[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Resize and encode menu card photo for OCR
  const processImageForOCR = (file: File): Promise<{ data: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 1800;
          let { width, height } = img;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            const raw = (e.target?.result as string) || '';
            const base64 = raw.includes(',') ? raw.split(',')[1] : raw;
            return resolve({ data: base64, mimeType: file.type || 'image/jpeg' });
          }
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          const base64 = dataUrl.split(',')[1];
          resolve({ data: base64, mimeType: 'image/jpeg' });
        };
        img.onerror = () => reject(new Error(`Could not load image: ${file.name}`));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error(`Could not read file: ${file.name}`));
      reader.readAsDataURL(file);
    });
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMessage(null);

    const newPreviews: UploadedFilePreview[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        continue;
      }
      newPreviews.push({
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    setUploadedFiles((prev) => [...prev, ...newPreviews]);
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => {
      const updated = [...prev];
      const removed = updated.splice(index, 1);
      if (removed[0]?.previewUrl) {
        URL.revokeObjectURL(removed[0].previewUrl);
      }
      return updated;
    });
  };

  // Run AI Extraction
  const handleStartExtraction = async () => {
    if (uploadedFiles.length === 0) {
      setErrorMessage('Please upload at least one menu card photo.');
      return;
    }

    setIsExtracting(true);
    setErrorMessage(null);

    try {
      // 1. Process all photos to base64
      const preparedImages = await Promise.all(
        uploadedFiles.map((up) => processImageForOCR(up.file))
      );

      // 2. Call server endpoint
      const token =
        adminToken ||
        (typeof window !== 'undefined' ? localStorage.getItem('hm_admin_token') : null);

      const res = await fetch('/api/admin/menu/extract-photos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ images: preparedImages }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Failed to extract menu items from photos.');
      }

      if (!data.items || data.items.length === 0) {
        throw new Error(
          'No food or beverage items could be detected from the uploaded photos. Please check that the menu photo is sharp, well-lit, and text is readable.'
        );
      }

      // 3. Map extracted items to draft state
      const drafts: DetectedItemDraft[] = data.items.map((item: any, idx: number) => ({
        id: `draft_${Date.now()}_${idx}`,
        name: item.name || '',
        categoryId: item.categoryId || categories[0]?.id || 'cat_biryani',
        price: item.price !== null && item.price !== undefined && item.price > 0 ? String(item.price) : '',
        isVeg: Boolean(item.isVeg),
        description: item.description || '',
        selected: true,
      }));

      setDetectedItems(drafts);
      setStep('preview');
    } catch (err: any) {
      console.error('Menu card extraction error:', err);
      setErrorMessage(err.message || 'An error occurred while reading the menu photo.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Toggle selection
  const handleToggleSelectAll = (select: boolean) => {
    setDetectedItems((prev) => prev.map((it) => ({ ...it, selected: select })));
  };

  const handleToggleSelectItem = (id: string) => {
    setDetectedItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, selected: !it.selected } : it))
    );
  };

  const handleUpdateDraft = (id: string, field: keyof DetectedItemDraft, value: any) => {
    setDetectedItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  const handleDeleteDraft = (id: string) => {
    setDetectedItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Confirm and Add Selected Items to Existing Menu
  const handleConfirmAndAdd = async () => {
    const selectedItems = detectedItems.filter((it) => it.selected);
    if (selectedItems.length === 0) {
      setErrorMessage('Please select at least one item to add to the menu.');
      return;
    }

    // Check if any items have empty or invalid names
    for (let i = 0; i < selectedItems.length; i++) {
      if (!selectedItems[i].name.trim()) {
        setErrorMessage(`Item #${i + 1} is missing a name. Please enter an item name.`);
        return;
      }
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const token =
        adminToken ||
        (typeof window !== 'undefined' ? localStorage.getItem('hm_admin_token') : null);

      // Prepare payload:
      // Requirement 5 & 6:
      // Do NOT use uploaded photo as food photo.
      // New imported food items must have blank/empty photo field.
      const payloadItems = selectedItems.map((it) => {
        const parsedPrice = parseFloat(it.price);
        return {
          name: it.name.trim(),
          categoryId: it.categoryId,
          price: isNaN(parsedPrice) || parsedPrice < 0 ? 0 : parsedPrice,
          description: it.description.trim(),
          imageUrl: '', // strictly blank / empty
          isVeg: it.isVeg,
          isAvailable: true,
          prepTimeMinutes: 10,
        };
      });

      const res = await fetch('/api/admin/menu/items/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ items: payloadItems }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save menu items.');
      }

      // Success
      if (Array.isArray(data.items)) {
        onItemsAdded(data.items);
      }

      // Cleanup
      uploadedFiles.forEach((up) => URL.revokeObjectURL(up.previewUrl));
      setUploadedFiles([]);
      setDetectedItems([]);
      onClose();
    } catch (err: any) {
      console.error('Failed to batch save menu items:', err);
      setErrorMessage(err.message || 'Failed to add items to menu. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered detected items
  const filteredDetectedItems = detectedItems.filter((it) => {
    if (filterCategory !== 'all' && it.categoryId !== filterCategory) {
      return false;
    }
    if (searchQuery.trim() && !it.name.toLowerCase().includes(searchQuery.toLowerCase().trim())) {
      return false;
    }
    return true;
  });

  const selectedCount = detectedItems.filter((it) => it.selected).length;
  const itemsWithoutPriceCount = detectedItems.filter(
    (it) => it.selected && (!it.price || parseFloat(it.price) <= 0)
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md">
      <div className="bg-[#0b2416] border border-[#214f34] w-full max-w-4xl max-h-[92vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#1b432a] flex items-center justify-between bg-[#081a10]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#dfb64c]/20 to-[#cba135]/5 border border-[#dfb64c]/40 flex items-center justify-center text-[#dfb64c]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-[#fcfaf6]">
                  AI Menu Card Photo Import
                </h3>
                <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full bg-[#174328] text-[#dfb64c] border border-[#2b6842]">
                  OCR & Auto-Categorization
                </span>
              </div>
              <p className="text-xs text-[#8ea896]">
                Upload printed menu card photos to automatically extract dish names, prices & categories
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#8ea896] hover:text-[#fcfaf6] p-1.5 rounded-lg hover:bg-[#153e26] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mx-4 mt-4 p-3 bg-red-950/85 border border-red-800/80 rounded-xl text-xs text-red-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-300">Notice</p>
              <p>{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {step === 'upload' ? (
            <div className="space-y-5">
              {/* Drop / Upload Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFilesSelected(e.dataTransfer.files);
                }}
                className="border-2 border-dashed border-[#2b6842] hover:border-[#dfb64c] bg-[#0d2919]/60 hover:bg-[#123620]/70 transition-all rounded-2xl p-6 sm:p-8 text-center cursor-pointer flex flex-col items-center justify-center gap-3 group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => handleFilesSelected(e.target.files)}
                  multiple
                  accept="image/*"
                  className="hidden"
                />

                <div className="w-14 h-14 rounded-2xl bg-[#143e26] border border-[#265e3b] flex items-center justify-center text-[#dfb64c] group-hover:scale-110 transition-transform">
                  <Camera className="w-7 h-7" />
                </div>

                <div>
                  <p className="text-sm font-semibold text-[#fcfaf6]">
                    Click to select or drag & drop menu card photos
                  </p>
                  <p className="text-xs text-[#8ea896] mt-1">
                    Supports multiple photos (e.g. Page 1, Page 2, drinks card, etc.) • JPG, PNG, WEBP
                  </p>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-[#dfb64c] font-medium bg-[#091a10] px-3 py-1.5 rounded-full border border-[#214f34]">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose Photos</span>
                </div>
              </div>

              {/* Uploaded Photos Grid */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#c9dcce]">
                      Selected Photos ({uploadedFiles.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-[#dfb64c] hover:underline font-medium cursor-pointer"
                    >
                      + Add More Photos
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {uploadedFiles.map((up, idx) => (
                      <div
                        key={idx}
                        className="relative group aspect-[4/3] rounded-xl overflow-hidden border border-[#214f34] bg-[#07170e]"
                      >
                        <img
                          src={up.previewUrl}
                          alt={`Menu card ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFile(idx);
                            }}
                            className="bg-red-700/90 text-white p-1.5 rounded-lg hover:bg-red-600 transition-colors cursor-pointer"
                            title="Remove photo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <span className="absolute bottom-1.5 left-1.5 text-[10px] bg-black/75 px-1.5 py-0.5 rounded text-[#fcfaf6] font-mono">
                          Photo {idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Information / Policy Notice */}
              <div className="bg-[#091c12] border border-[#1b432a] rounded-xl p-3.5 space-y-2 text-xs text-[#9eb7a6]">
                <div className="flex items-center gap-2 text-[#dfb64c] font-semibold text-xs">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>How AI Import Works</span>
                </div>
                <ul className="space-y-1 pl-5 list-disc text-[11px] leading-relaxed">
                  <li>
                    <strong className="text-[#e2ece5]">Text & Item Extraction:</strong> AI extracts
                    only real food and drink names. Restaurant headers, addresses, and disclaimers
                    are strictly excluded.
                  </li>
                  <li>
                    <strong className="text-[#e2ece5]">Automatic Categorization:</strong> Each dish
                    is categorized into existing categories like Breakfast, Biryani, Roti Items,
                    Grill & Shawarma, Meals, etc.
                  </li>
                  <li>
                    <strong className="text-[#e2ece5]">Blank Food Photo:</strong> The menu card photo is
                    never used as the dish image. Imported items start with a blank photo so you can
                    upload beautiful food photos individually.
                  </li>
                  <li>
                    <strong className="text-[#e2ece5]">Safe & Non-Destructive:</strong> Your existing
                    menu items will never be modified or overwritten.
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            /* STEP 2: PREVIEW & CONFIRMATION SCREEN */
            <div className="space-y-4">
              {/* Header stats and filters */}
              <div className="bg-[#091d12] border border-[#1c452b] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="text-xs">
                    <span className="text-[#8ea896]">Detected Items: </span>
                    <strong className="text-[#dfb64c] text-sm">{detectedItems.length}</strong>
                    <span className="text-[#8ea896] ml-2">({selectedCount} selected)</span>
                  </div>

                  {itemsWithoutPriceCount > 0 && (
                    <span className="text-[11px] bg-amber-950/80 border border-amber-700/80 text-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{itemsWithoutPriceCount} items need price</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAll(true)}
                    className="text-xs text-[#dfb64c] hover:underline font-medium cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-[#406850]">|</span>
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAll(false)}
                    className="text-xs text-[#8ea896] hover:text-[#fcfaf6] cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Filters bar */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter detected items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 min-w-[180px] bg-[#123620] border border-[#245937] rounded-xl px-3 py-1.5 text-xs text-[#fcfaf6] placeholder-[#6d8a76] focus:outline-none focus:border-[#dfb64c]"
                />

                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-[#123620] border border-[#245937] rounded-xl px-3 py-1.5 text-xs text-[#fcfaf6] focus:outline-none focus:border-[#dfb64c]"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="text-xs text-[#8ea896] hover:text-[#fcfaf6] bg-[#123620] px-3 py-1.5 rounded-xl border border-[#245937] cursor-pointer flex items-center gap-1"
                >
                  <Camera className="w-3.5 h-3.5 text-[#dfb64c]" />
                  <span>Scan Different Photos</span>
                </button>
              </div>

              {/* Detected Items List */}
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {filteredDetectedItems.length === 0 ? (
                  <div className="text-center py-8 text-xs text-[#799983] bg-[#091a10] rounded-xl border border-[#1b432a]">
                    No items match the current filter.
                  </div>
                ) : (
                  filteredDetectedItems.map((item, idx) => {
                    const hasPrice = item.price && parseFloat(item.price) > 0;

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border transition-colors ${
                          item.selected
                            ? 'bg-[#0e2a1b] border-[#29643f]'
                            : 'bg-[#08180f]/60 border-[#153822] opacity-60'
                        } flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between`}
                      >
                        {/* Checkbox and Name */}
                        <div className="flex items-center gap-2.5 flex-1 min-w-[220px]">
                          <button
                            type="button"
                            onClick={() => handleToggleSelectItem(item.id)}
                            className="text-[#dfb64c] hover:scale-105 transition-transform cursor-pointer"
                          >
                            {item.selected ? (
                              <CheckSquare className="w-5 h-5 fill-[#dfb64c]/20 text-[#dfb64c]" />
                            ) : (
                              <Square className="w-5 h-5 text-[#558064]" />
                            )}
                          </button>

                          <div className="flex-1">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => handleUpdateDraft(item.id, 'name', e.target.value)}
                              placeholder="Item Name"
                              className="w-full bg-[#0a2014] border border-[#214f34] rounded-lg px-2.5 py-1 text-xs font-semibold text-[#fcfaf6] focus:outline-none focus:border-[#dfb64c]"
                            />
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-[#799983]">
                              <span>Photo: Blank (Upload later)</span>
                              <span>•</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateDraft(item.id, 'isVeg', !item.isVeg)}
                                className={`px-1.5 py-0.2 rounded border font-medium cursor-pointer ${
                                  item.isVeg
                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80'
                                    : 'bg-red-950/80 text-red-300 border-red-700/80'
                                }`}
                              >
                                {item.isVeg ? 'Veg' : 'Non-Veg'}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Category Dropdown and Price */}
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          {/* Category select */}
                          <select
                            value={item.categoryId}
                            onChange={(e) =>
                              handleUpdateDraft(item.id, 'categoryId', e.target.value)
                            }
                            className="bg-[#0a2014] border border-[#214f34] rounded-lg px-2 py-1 text-xs text-[#c9dcce] focus:outline-none focus:border-[#dfb64c] max-w-[160px]"
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>

                          {/* Price Input */}
                          <div className="relative w-24">
                            <span className="absolute left-2 top-1 text-xs text-[#7fa38a]">₹</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={item.price}
                              onChange={(e) => handleUpdateDraft(item.id, 'price', e.target.value)}
                              placeholder="Price"
                              className={`w-full bg-[#0a2014] border ${
                                !hasPrice ? 'border-amber-600/80 text-amber-200' : 'border-[#214f34] text-[#dfb64c]'
                              } rounded-lg pl-5 pr-2 py-1 text-xs font-mono font-bold focus:outline-none focus:border-[#dfb64c]`}
                              title={!hasPrice ? 'Price could not be read. Please enter price.' : 'Price in ₹'}
                            />
                          </div>

                          {/* Delete item draft button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteDraft(item.id)}
                            className="text-[#6d8a76] hover:text-red-400 p-1 rounded transition-colors cursor-pointer"
                            title="Remove from import list"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-[#1b432a] bg-[#081a10] flex flex-wrap items-center justify-between gap-3">
          {step === 'upload' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-[#8ea896] hover:text-[#fcfaf6] rounded-xl hover:bg-[#123620] transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={uploadedFiles.length === 0 || isExtracting}
                onClick={handleStartExtraction}
                className="bg-gradient-to-r from-[#dfb64c] to-[#cba135] text-[#0a1f13] font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow flex items-center gap-2 cursor-pointer hover:from-[#ebd06b] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExtracting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Extracting Menu with AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Extract Menu Items ({uploadedFiles.length} Photos)</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="px-4 py-2 text-xs font-semibold text-[#8ea896] hover:text-[#fcfaf6] rounded-xl hover:bg-[#123620] transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>← Back to Upload</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-[#8ea896] hover:text-[#fcfaf6] rounded-xl hover:bg-[#123620] transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  id="confirm-add-imported-menu-items-btn"
                  disabled={selectedCount === 0 || isSaving}
                  onClick={handleConfirmAndAdd}
                  className="bg-gradient-to-r from-[#dfb64c] to-[#cba135] text-[#0a1f13] font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow flex items-center gap-2 cursor-pointer hover:from-[#ebd06b] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Adding to Menu...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Add Selected Items to Menu ({selectedCount})</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
