import React, { useState, useEffect } from 'react';
import {
  Building,
  Upload,
  Save,
  CheckCircle2,
  AlertCircle,
  Phone,
  Clock,
  ShieldCheck,
  MapPin,
  RefreshCw,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import { RestaurantProfile } from '../types';
import { WatermarkedImage } from './WatermarkedImage';
import { applyWatermarkToImageFile, EXACT_WATERMARK_TEXT } from '../utils/watermark';

interface AdminProfileManagerProps {
  adminToken: string;
  onProfileUpdated?: (profile: RestaurantProfile) => void;
}

export const AdminProfileManager: React.FC<AdminProfileManagerProps> = ({
  adminToken,
  onProfileUpdated,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [form, setForm] = useState<RestaurantProfile>({
    name: 'Hotel Malabar',
    tagline: 'Authentic Thalassery Biryani, Handcrafted Kerala Porottas & Coastal Delicacies',
    description:
      'Serving rich Malabar heritage and mouthwatering Malabar flavours. Freshly prepared with traditional spices and authentic recipes passed down generations.',
    logoUrl: '',
    coverPhotoUrl:
      'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1200&q=85',
    address: 'Hotel Malabar, Main Road, Near Bus Stand, Bommasandra Industrial Area, Bangalore - 560099',
    landmark: 'Opposite Metro Station Pillar 42',
    phones: ['9567562071', '8904634717'],
    fssaiNumber: '11223344000185',
    openingHours: '11:00 AM – 11:30 PM (Daily)',
    isOnlineOrderOpen: true,
  });

  const [logoUploading, setLogoUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setForm({
          name: data.name || 'Hotel Malabar',
          tagline: data.tagline || '',
          description: data.description || '',
          logoUrl: data.logoUrl || '',
          coverPhotoUrl: data.coverPhotoUrl || '',
          address: data.address || '',
          landmark: data.landmark || '',
          phones: Array.isArray(data.phones) && data.phones.length > 0 ? data.phones : ['9567562071', '8904634717'],
          fssaiNumber: data.fssaiNumber || '',
          openingHours: data.openingHours || '11:00 AM – 11:30 PM',
          isOnlineOrderOpen: data.isOnlineOrderOpen !== false,
        });
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update restaurant profile');
      }

      setSuccessMessage('Hotel Malabar profile & branding saved successfully!');
      if (onProfileUpdated && data.profile) {
        onProfileUpdated(data.profile);
      }
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error saving profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLogoUploading(true);
      // Automatically bakes watermark: "This is made by INSTA ID @thee.juuu"
      const watermarkedBase64 = await applyWatermarkToImageFile(file);
      setForm((prev) => ({ ...prev, logoUrl: watermarkedBase64 }));
    } catch (err) {
      alert('Failed to process and watermark logo image. Please try another image.');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCoverUploading(true);
      // Automatically bakes watermark: "This is made by INSTA ID @thee.juuu"
      const watermarkedBase64 = await applyWatermarkToImageFile(file);
      setForm((prev) => ({ ...prev, coverPhotoUrl: watermarkedBase64 }));
    } catch (err) {
      alert('Failed to process and watermark cover photo. Please try another image.');
    } finally {
      setCoverUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#a6bfae] gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-[#dfb64c]" />
        <span>Loading restaurant profile...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="pb-3 border-b border-[#1b432a] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-brand font-bold text-[#fcfaf6] flex items-center gap-2">
            <Building className="w-5 h-5 text-[#dfb64c]" />
            <span>Hotel Malabar Restaurant Profile & Branding</span>
          </h2>
          <p className="text-xs text-[#8ea896]">
            Manage restaurant name, photos, logo, contact hotlines, address, and live online order status.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#123620] border border-[#245937] px-3 py-1.5 rounded-xl text-xs text-[#dfb64c]">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Auto Watermark Active: &ldquo;{EXACT_WATERMARK_TEXT}&rdquo;</span>
        </div>
      </div>

      {successMessage && (
        <div className="bg-emerald-950/80 border border-emerald-500/80 text-emerald-200 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-950/80 border border-red-500/80 text-red-200 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: PHOTOS & LOGO */}
        <div className="bg-[#0f2d1c] border border-[#235836] rounded-2xl p-5 space-y-6">
          <div className="border-b border-[#1c472d] pb-2">
            <h3 className="text-sm font-semibold text-[#fcfaf6] flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[#dfb64c]" />
              <span>Restaurant Photos & Watermarked Branding</span>
            </h3>
            <p className="text-[11px] text-[#8ea896]">
              Upload or replace restaurant logo and showcase photo. All images are automatically branded with the required watermark.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* LOGO CARD */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-[#dfb64c]">
                Hotel Malabar Logo / Profile Photo (DP)
              </label>

              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-[#cba135] bg-[#081a10] relative flex-shrink-0 shadow-lg">
                  {form.logoUrl ? (
                    <WatermarkedImage
                      src={form.logoUrl}
                      alt="Hotel Malabar Logo"
                      className="w-full h-full"
                      watermarkSize="sm"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-[#799983]">
                      <Building className="w-6 h-6 text-[#dfb64c] mb-1" />
                      <span className="text-[9px] uppercase font-bold text-[#e8dcb8]">Est. Malabar</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 flex-1">
                  <label className="inline-flex items-center gap-1.5 bg-[#143d26] hover:bg-[#1d5435] text-[#dfb64c] border border-[#cba135]/50 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{logoUploading ? 'Watermarking...' : 'Upload / Replace Logo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={logoUploading}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[10px] text-[#8ea896] leading-relaxed">
                    Square PNG/JPG recommended. Watermark is auto-baked onto image corner.
                  </p>

                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="text-[#8ea896]">Presets:</span>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          logoUrl:
                            'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&q=80',
                        }))
                      }
                      className="text-[#dfb64c] hover:underline cursor-pointer"
                    >
                      Bistro Crest
                    </button>
                    <span className="text-[#41684d]">•</span>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, logoUrl: '' }))}
                      className="text-[#dfb64c] hover:underline cursor-pointer"
                    >
                      Golden Emblem
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* COVER / SHOWCASE PHOTO CARD */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-[#dfb64c]">
                Restaurant Showcase / Cover Photo
              </label>

              <div className="space-y-2">
                <div className="aspect-[16/9] w-full rounded-2xl overflow-hidden border-2 border-[#cba135]/50 bg-[#081a10] relative shadow-lg">
                  <WatermarkedImage
                    src={form.coverPhotoUrl}
                    alt="Hotel Malabar Showcase Photo"
                    className="w-full h-full"
                    watermarkSize="md"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-1.5 bg-[#143d26] hover:bg-[#1d5435] text-[#dfb64c] border border-[#cba135]/50 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{coverUploading ? 'Watermarking...' : 'Upload / Replace Cover Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverUpload}
                      disabled={coverUploading}
                      className="hidden"
                    />
                  </label>

                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-[#8ea896]">Presets:</span>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          coverPhotoUrl:
                            'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1200&q=85',
                        }))
                      }
                      className="text-[#dfb64c] hover:underline cursor-pointer"
                    >
                      Dum Biryani Feast
                    </button>
                    <span className="text-[#41684d]">•</span>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          coverPhotoUrl:
                            'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=85',
                        }))
                      }
                      className="text-[#dfb64c] hover:underline cursor-pointer"
                    >
                      Warm Ambience
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: RESTAURANT DETAILS */}
        <div className="bg-[#0f2d1c] border border-[#235836] rounded-2xl p-5 space-y-4">
          <div className="border-b border-[#1c472d] pb-2">
            <h3 className="text-sm font-semibold text-[#fcfaf6]">Restaurant Details & Descriptions</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#c9dcce] mb-1">
                Restaurant Name
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-[#123620] border border-[#245937] rounded-xl px-3 py-2 text-sm text-[#fcfaf6] focus:outline-none focus:border-[#dfb64c]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#c9dcce] mb-1">
                Tagline / Specialty
              </label>
              <input
                type="text"
                required
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                className="w-full bg-[#123620] border border-[#245937] rounded-xl px-3 py-2 text-sm text-[#fcfaf6] focus:outline-none focus:border-[#dfb64c]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#c9dcce] mb-1">
              About Hotel Malabar (Description)
            </label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full bg-[#123620] border border-[#245937] rounded-xl px-3 py-2 text-xs text-[#fcfaf6] focus:outline-none focus:border-[#dfb64c]"
            />
          </div>
        </div>

        {/* SECTION 3: CONTACT & LOCATION */}
        <div className="bg-[#0f2d1c] border border-[#235836] rounded-2xl p-5 space-y-4">
          <div className="border-b border-[#1c472d] pb-2">
            <h3 className="text-sm font-semibold text-[#fcfaf6] flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#dfb64c]" />
              <span>Location, Hotlines & Operations</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#c9dcce] mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-[#dfb64c]" />
                <span>Primary Hotline Phone</span>
              </label>
              <input
                type="text"
                required
                value={form.phones[0] || ''}
                onChange={(e) => {
                  const newPhones = [...form.phones];
                  newPhones[0] = e.target.value.trim();
                  setForm({ ...form, phones: newPhones });
                }}
                placeholder="9567562071"
                className="w-full bg-[#123620] border border-[#245937] rounded-xl px-3 py-2 text-sm text-[#fcfaf6] font-mono focus:outline-none focus:border-[#dfb64c]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#c9dcce] mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-[#dfb64c]" />
                <span>Secondary Hotline Phone</span>
              </label>
              <input
                type="text"
                value={form.phones[1] || ''}
                onChange={(e) => {
                  const newPhones = [...form.phones];
                  newPhones[1] = e.target.value.trim();
                  setForm({ ...form, phones: newPhones });
                }}
                placeholder="8904634717"
                className="w-full bg-[#123620] border border-[#245937] rounded-xl px-3 py-2 text-sm text-[#fcfaf6] font-mono focus:outline-none focus:border-[#dfb64c]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#c9dcce] mb-1">
                Restaurant Physical Address
              </label>
              <input
                type="text"
                required
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full bg-[#123620] border border-[#245937] rounded-xl px-3 py-2 text-sm text-[#fcfaf6] focus:outline-none focus:border-[#dfb64c]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#c9dcce] mb-1">
                Landmark
              </label>
              <input
                type="text"
                value={form.landmark || ''}
                onChange={(e) => setForm({ ...form, landmark: e.target.value })}
                placeholder="Opposite Metro Station"
                className="w-full bg-[#123620] border border-[#245937] rounded-xl px-3 py-2 text-sm text-[#fcfaf6] focus:outline-none focus:border-[#dfb64c]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#c9dcce] mb-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#dfb64c]" />
                <span>FSSAI License Number</span>
              </label>
              <input
                type="text"
                value={form.fssaiNumber || ''}
                onChange={(e) => setForm({ ...form, fssaiNumber: e.target.value })}
                placeholder="11223344000185"
                className="w-full bg-[#123620] border border-[#245937] rounded-xl px-3 py-2 text-sm text-[#fcfaf6] font-mono focus:outline-none focus:border-[#dfb64c]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#c9dcce] mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#dfb64c]" />
                <span>Opening Hours</span>
              </label>
              <input
                type="text"
                value={form.openingHours}
                onChange={(e) => setForm({ ...form, openingHours: e.target.value })}
                placeholder="11:00 AM – 11:30 PM"
                className="w-full bg-[#123620] border border-[#245937] rounded-xl px-3 py-2 text-sm text-[#fcfaf6] focus:outline-none focus:border-[#dfb64c]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#c9dcce] mb-1">
                Online Ordering Status
              </label>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isOnlineOrderOpen: !form.isOnlineOrderOpen })}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    form.isOnlineOrderOpen
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-500'
                      : 'bg-red-950 text-red-300 border-red-500'
                  }`}
                >
                  {form.isOnlineOrderOpen ? '● Kitchen Accepting Orders' : '○ Kitchen Closed Temporarily'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SUBMIT BUTTON */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || logoUploading || coverUploading}
            className="bg-gradient-to-r from-[#dfb64c] to-[#cba135] hover:from-[#e7c35d] text-[#0a1f13] font-bold px-6 py-3 rounded-xl shadow-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving Profile...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Hotel Malabar Profile Changes</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Admin Account Security & Password Management */}
      <AdminPasswordChangeCard adminToken={adminToken} />
    </div>
  );
};

// Component for updating admin password securely with bcrypt hashing on backend
const AdminPasswordChangeCard: React.FC<{ adminToken: string }> = ({ adminToken }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword.length < 8) {
      setStatus('error');
      setMessage('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus('error');
      setMessage('New password and confirmation do not match.');
      return;
    }

    try {
      setStatus('loading');
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update password');

      setStatus('success');
      setMessage('Admin password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Failed to update admin password.');
    }
  };

  return (
    <div className="bg-[#0f2d1c] border border-[#235836] rounded-2xl p-6 space-y-4 max-w-xl">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#174229] border border-[#dfb64c] flex items-center justify-center text-[#dfb64c]">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-[#fcfaf6]">Update Admin Password</h3>
          <p className="text-xs text-[#8ea896]">
            Only authorized admin phone accounts can modify security credentials.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            status === 'success'
              ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-300'
              : 'bg-red-950/80 border border-red-500 text-red-300'
          }`}
        >
          {status === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-[#c9dcce] mb-1">
            Current Password
          </label>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
            className="w-full bg-[#123620] border border-[#245937] rounded-xl px-3 py-2 text-sm text-[#fcfaf6] focus:outline-none focus:border-[#dfb64c]"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#c9dcce] mb-1">
            New Admin Password (min 8 characters)
          </label>
          <input
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new strong password"
            className="w-full bg-[#123620] border border-[#245937] rounded-xl px-3 py-2 text-sm text-[#fcfaf6] focus:outline-none focus:border-[#dfb64c]"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#c9dcce] mb-1">
            Confirm New Admin Password
          </label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-type new password"
            className="w-full bg-[#123620] border border-[#245937] rounded-xl px-3 py-2 text-sm text-[#fcfaf6] focus:outline-none focus:border-[#dfb64c]"
          />
        </div>

        <button
          type="submit"
          disabled={status === 'loading'}
          className="bg-[#184428] hover:bg-[#205734] border border-[#dfb64c]/70 text-[#dfb64c] font-bold text-xs py-2.5 px-5 rounded-xl transition-all cursor-pointer disabled:opacity-50"
        >
          {status === 'loading' ? 'Updating Password...' : 'Save New Password'}
        </button>
      </form>
    </div>
  );
};
