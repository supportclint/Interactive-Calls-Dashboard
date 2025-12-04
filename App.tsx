import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Conversations from './pages/Conversations';
import AdminPanel from './pages/AdminPanel';
import AdminAnalytics from './pages/AdminAnalytics';
import Profile from './pages/Profile';
import ApiDocumentation from './pages/ApiDocumentation';
import { UserRole, Client, AdminProfile } from './types';
import { DataService } from './services/dataService';
import { Loader2, Lock, User, Menu } from 'lucide-react';

// Main Layout Wrapper
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-slate-50 min-h-screen font-sans">
    {children}
  </div>
);

const App: React.FC = () => {
  // State to manage session
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Authenticated User (Client or AdminProfile)
  const [currentUser, setCurrentUser] = useState<Client | AdminProfile | null>(null); 
  
  // Admin Impersonation State
  const [impersonatedClient, setImpersonatedClient] = useState<Client | null>(null);

  // Login Form State
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Check for existing session on load
  useEffect(() => {
    const session = DataService.getSession();
    if (session) {
      setUserRole(session.role);
      setCurrentUser(session.user);
      
      if (session.role === UserRole.CLIENT) {
        setActivePage('dashboard');
      } else {
        setActivePage('analytics');
      }
    }
    setIsLoadingSession(false);
  }, []);

  // Determine effective view context for CLIENT views
  const isImpersonating = !!impersonatedClient && userRole === UserRole.ADMIN;
  const effectiveClient = isImpersonating ? impersonatedClient : (currentUser as Client);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    try {
      const result = await DataService.login(loginId, password);
      
      if (result) {
        setUserRole(result.role);
        setCurrentUser(result.user);
        
        if (result.role === UserRole.CLIENT) {
          setActivePage('dashboard');
        } else {
          setActivePage('analytics');
        }
      } else {
        setLoginError('Invalid credentials. Please try again.');
      }
    } catch (err) {
      setLoginError('An error occurred during login.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleImpersonate = (client: Client) => {
    setImpersonatedClient(client);
    setActivePage('dashboard');
    setIsMobileMenuOpen(false);
  };

  const exitImpersonation = () => {
    setImpersonatedClient(null);
    setActivePage('admin'); // Return to Client Management list
    setIsMobileMenuOpen(false);
  };

  const handleLogout = () => {
    DataService.clearSession();
    setUserRole(null);
    setCurrentUser(null);
    setImpersonatedClient(null);
    setLoginId('');
    setPassword('');
    setIsMobileMenuOpen(false);
  };

  const handleNavigate = (page: string) => {
    setActivePage(page);
    setIsMobileMenuOpen(false);
  };

  if (isLoadingSession) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white"><Loader2 className="animate-spin mr-2" /> Loading...</div>;
  }

  // Login Screen
  if (!userRole) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-md w-full border border-slate-700">
          <div className="text-center mb-8">
            {/* COMPANY LOGO */}
            <img 
              src="/logo.png" 
              alt="InteractiveCalls" 
              className="h-20 mx-auto mb-6 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                // Show text if image fails
                e.currentTarget.parentElement!.querySelector('.fallback-title')?.classList.remove('hidden');
              }}
            />
            <h1 className="text-2xl font-bold text-white fallback-title hidden">InteractiveCalls</h1>
            <p className="text-slate-400 mt-2">Sign in to your dashboard</p>
          </div>
          
          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Login ID / Email</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  required
                  autoFocus
                  placeholder="Enter your Login ID"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-white placeholder-slate-500"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-white placeholder-slate-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {loginError && (
              <div className="p-3 bg-red-900/30 border border-red-800 text-red-200 text-sm rounded-lg flex items-center gap-2 animate-in fade-in">
                <span className="block w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                {loginError}
              </div>
            )}

            <button 
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl transition-all flex items-center justify-center shadow-lg shadow-brand-900/20 disabled:opacity-70 disabled:cursor-not-allowed"
            >
               {isLoggingIn ? <Loader2 className="animate-spin" /> : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <Sidebar 
        currentRole={userRole}
        activePage={activePage}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        isImpersonating={isImpersonating}
        onExitImpersonation={exitImpersonation}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
      
      {/* Mobile Header */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-40 shadow-md">
         <div className="flex items-center gap-3">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="h-8 w-auto object-contain" 
              onError={(e) => e.currentTarget.style.display = 'none'}
            />
         </div>
         <button 
           onClick={() => setIsMobileMenuOpen(true)}
           className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
         >
            <Menu size={24} />
         </button>
      </div>

      {/* Content Wrapper to handle Footer positioning */}
      <div className="md:ml-64 min-h-screen flex flex-col transition-all duration-300">
        <main className="flex-1 p-4 md:p-8">
          {/* Content Routing */}
          {activePage === 'dashboard' && effectiveClient && (
            <Dashboard client={effectiveClient} />
          )}

          {activePage === 'conversations' && effectiveClient && (
            <Conversations client={effectiveClient} />
          )}

          {/* Admin Routes */}
          {activePage === 'admin' && userRole === UserRole.ADMIN && !isImpersonating && (
            <AdminPanel onImpersonate={handleImpersonate} />
          )}

          {activePage === 'analytics' && userRole === UserRole.ADMIN && !isImpersonating && (
            <AdminAnalytics />
          )}

          {activePage === 'apidocs' && userRole === UserRole.ADMIN && !isImpersonating && (
            <ApiDocumentation />
          )}
          
          {/* Profile Route - Accessible by both */}
          {activePage === 'profile' && (
             <Profile 
               role={userRole} 
               userId={userRole === UserRole.CLIENT ? effectiveClient?.id : currentUser?.id} 
             />
          )}
          
          {/* Fallbacks */}
          {activePage === 'dashboard' && !effectiveClient && (
             <div className="text-center text-slate-500 mt-20">Select a client to view their dashboard.</div>
          )}
        </main>

        {/* Footer */}
        <footer className="px-6 py-6 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center text-xs text-slate-400 bg-slate-50 gap-2 mt-auto">
          <p>Copyright &copy; 2025 All Rights Reserved</p>
          <p>Version 1.1.5 Beta</p>
        </footer>
      </div>
    </Layout>
  );
};

export default App;