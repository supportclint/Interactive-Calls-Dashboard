
import React from 'react';
import { Home, Users, Phone, LogOut, Shield, PieChart, Settings, X, Code } from 'lucide-react';
import { UserRole } from '../types';

interface SidebarProps {
  currentRole: UserRole;
  activePage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  onExitImpersonation?: () => void;
  isImpersonating: boolean;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentRole, 
  activePage, 
  onNavigate, 
  onLogout,
  onExitImpersonation,
  isImpersonating,
  isOpen,
  onClose
}) => {
  
  const menuItems = [
    // Admin Specific Items (Visible only to Admin when NOT impersonating)
    { id: 'analytics', label: 'Global Analytics', icon: PieChart, visible: currentRole === UserRole.ADMIN && !isImpersonating },
    { id: 'admin', label: 'Client Management', icon: Users, visible: currentRole === UserRole.ADMIN && !isImpersonating },
    { id: 'apidocs', label: 'API Docs', icon: Code, visible: currentRole === UserRole.ADMIN && !isImpersonating },

    // Client Specific Items (Visible to Client OR Admin when impersonating)
    { id: 'dashboard', label: 'Dashboard', icon: Home, visible: currentRole === UserRole.CLIENT || isImpersonating },
    { id: 'conversations', label: 'Conversations', icon: Phone, visible: currentRole === UserRole.CLIENT || isImpersonating },
    
    // Shared Items
    { id: 'profile', label: 'Profile', icon: Settings, visible: true },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 text-white flex flex-col shadow-2xl transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0
      `}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between h-[88px]">
          {/* COMPANY LOGO */}
          <div className="flex items-center gap-3 overflow-hidden">
             <img 
               src="/logo.png" 
               alt="InteractiveCalls" 
               className="max-h-10 w-auto object-contain"
               onError={(e) => {
                 // Fallback if image is missing
                 e.currentTarget.style.display = 'none';
                 e.currentTarget.parentElement!.innerHTML = '<span class="font-bold text-lg tracking-tight">InteractiveCalls</span>';
               }}
             />
          </div>
          
          {/* Mobile Close Button */}
          <button 
            onClick={onClose}
            className="md:hidden p-1 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {isImpersonating && (
             <div className="mb-6 bg-indigo-900/50 p-3 rounded-lg border border-indigo-500/30">
               <p className="text-xs text-indigo-200 mb-2 uppercase font-semibold">Viewing As Client</p>
               <button 
                  onClick={onExitImpersonation}
                  className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white w-full py-2 rounded transition-colors flex items-center justify-center gap-2"
               >
                 <LogOut size={14} /> Exit View
               </button>
             </div>
          )}

          {menuItems.filter(item => item.visible).map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                activePage === item.id 
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/50 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 shrink-0">
              {currentRole === UserRole.ADMIN ? <Shield size={20} /> : <Users size={20} />}
            </div>
            <div className="flex-1 overflow-hidden min-w-0">
              <p className="text-sm font-medium truncate">
                {currentRole === UserRole.ADMIN && !isImpersonating ? 'Admin User' : 'Client User'}
              </p>
              <p className="text-xs text-slate-500 truncate">app.interactivecalls.com.au</p>
            </div>
            <button 
              onClick={onLogout}
              className="text-slate-400 hover:text-white transition-colors"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
