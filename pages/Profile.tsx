
import React, { useState, useEffect, useRef } from 'react';
import { UserRole, Client, AdminProfile } from '../types';
import { DataService } from '../services/dataService';
import { Camera, Save, Mail, User, Building, Globe, Shield, Lock } from 'lucide-react';

interface ProfileProps {
  role: UserRole;
  userId?: string; // Generic ID for both Client and Admin
}

const Profile: React.FC<ProfileProps> = ({ role, userId }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);
  
  // Flexible state to hold either Client or Admin data
  const [profileData, setProfileData] = useState<any>(null);
  
  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
  }, [role, userId]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      if (role === UserRole.ADMIN && userId) {
        const admin = await DataService.getAdminById(userId);
        setProfileData(admin);
      } else if (role === UserRole.CLIENT && userId) {
        const client = await DataService.getClientById(userId);
        setProfileData(client);
      }
    } catch (error) {
      console.error("Failed to load profile", error);
      setMessage({ text: "Failed to load profile data.", type: 'error' });
    }
    setLoading(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setProfileData({ ...profileData, avatarUrl: objectUrl });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    // Password Validation
    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ text: "New passwords do not match.", type: 'error' });
      setSaving(false);
      return;
    }

    try {
      // Prepare data to save (merge new password if set)
      const dataToSave = { ...profileData };
      if (newPassword) {
        dataToSave.password = newPassword;
      }

      if (role === UserRole.ADMIN) {
        await DataService.updateAdmin(dataToSave as AdminProfile);
      } else {
        await DataService.updateClient(dataToSave as Client);
      }
      
      setMessage({ text: "Profile updated successfully!", type: 'success' });
      setNewPassword('');
      setConfirmPassword('');
      // Reload data to confirm consistency
      await loadProfile();
    } catch (error) {
      console.error("Failed to save profile", error);
      setMessage({ text: "Failed to save changes.", type: 'error' });
    } finally {
      setSaving(false);
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    }
  };

  if (loading) return <div className="p-8 flex justify-center text-slate-500">Loading profile...</div>;
  if (!profileData) return <div className="p-8 text-red-500">Profile not found.</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Profile & Settings</h1>
        <p className="text-slate-500">Manage your account information and appearance.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Top Card: Avatar & Basic Info */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-slate-800 to-slate-900"></div>
          <div className="px-8 pb-8 relative">
            {/* Avatar Upload */}
            <div className="relative -mt-12 mb-6 inline-block group">
              <div className="w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden bg-white">
                <img 
                  src={profileData.avatarUrl} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              </div>
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 bg-brand-600 text-white p-2 rounded-full shadow-lg hover:bg-brand-700 transition-colors"
                title="Change Photo"
              >
                <Camera size={16} />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleImageUpload}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    {role === UserRole.ADMIN ? 'Admin Name' : 'Company Name'}
                  </label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      required
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white text-slate-900"
                      value={profileData.name}
                      onChange={e => setProfileData({...profileData, name: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      required
                      type="email"
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white text-slate-900"
                      value={profileData.email}
                      onChange={e => setProfileData({...profileData, email: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Role Specific Fields */}
              <div className="space-y-4">
                 {role === UserRole.CLIENT && (
                   <>
                     <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                          Language Preference
                        </label>
                        <div className="relative">
                          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <select 
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white text-slate-900 appearance-none"
                            value={profileData.language || 'English'}
                            onChange={e => setProfileData({...profileData, language: e.target.value})}
                          >
                            <option>English</option>
                            <option>Spanish</option>
                            <option>French</option>
                            <option>German</option>
                          </select>
                        </div>
                     </div>

                     <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                          Account Type
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input 
                            disabled
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
                            value="Client Account"
                          />
                        </div>
                     </div>
                   </>
                 )}

                 {role === UserRole.ADMIN && (
                   <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                        Role
                      </label>
                      <div className="relative">
                        <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          disabled
                          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
                          value="System Administrator"
                        />
                      </div>
                   </div>
                 )}
              </div>
            </div>
          </div>
        </div>

        {/* Login & Security Section (For Both Admin and Client) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Lock className="text-slate-400" size={20} /> Login & Security
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             {/* Client ID is only editable for clients. Admins use email. */}
             {role === UserRole.CLIENT && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    Login ID
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                       required
                       className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white text-slate-900"
                       value={profileData.memberLoginId || ''}
                       onChange={e => setProfileData({...profileData, memberLoginId: e.target.value})}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">This is the ID used to sign in to the dashboard.</p>
                </div>
             )}

             <div className={`${role === UserRole.ADMIN ? 'col-span-2 grid grid-cols-2 gap-8' : 'space-y-4'}`}>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    New Password
                  </label>
                  <input 
                     type="password"
                     placeholder="Leave blank to keep current"
                     className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white text-slate-900"
                     value={newPassword}
                     onChange={e => setNewPassword(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    Confirm Password
                  </label>
                  <input 
                     type="password"
                     placeholder="Confirm new password"
                     className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white text-slate-900"
                     value={confirmPassword}
                     onChange={e => setConfirmPassword(e.target.value)}
                  />
                </div>
             </div>
          </div>
        </div>

        {/* Save Actions */}
        <div className="flex items-center justify-between pt-4">
           <div>
             {message && (
               <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                 message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
               }`}>
                 {message.text}
               </span>
             )}
           </div>
           <button 
             type="submit"
             disabled={saving}
             className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-sm flex items-center gap-2 transition-all disabled:opacity-70"
           >
             {saving ? 'Saving...' : <><Save size={18} /> Save Changes</>}
           </button>
        </div>
      </form>
    </div>
  );
};

export default Profile;
