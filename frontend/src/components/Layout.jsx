import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import api from '../api';
import {
  HiOutlineViewGrid, HiOutlineUserGroup, HiOutlineCube, HiOutlineShoppingCart,
  HiOutlineClipboardList, HiOutlineCalendar, HiOutlineCurrencyDollar,
  HiOutlineChartBar, HiOutlineLogout, HiOutlineMenu, HiOutlineX, HiOutlineTruck,
  HiOutlineHeart, HiOutlineCollection, HiOutlineShieldCheck
} from 'react-icons/hi';

const allNavItems = [
  { path: '/', label: 'Dashboard', icon: HiOutlineViewGrid, roles: ['admin', 'manager', 'employee', 'hr'] },
  { path: '/employees', label: 'Employees', icon: HiOutlineUserGroup, roles: ['admin', 'hr'] },
  { path: '/stockists', label: 'Stockists', icon: HiOutlineTruck, roles: ['admin', 'manager'] },
  { path: '/products', label: 'Products', icon: HiOutlineCube, roles: ['admin'] },
  { path: '/batches', label: 'Batches', icon: HiOutlineCollection, roles: ['admin'] },
  { path: '/doctors', label: 'Doctors', icon: HiOutlineHeart, roles: ['admin', 'manager', 'employee'] },
  { path: '/sales', label: 'Sales', icon: HiOutlineShoppingCart, roles: ['admin', 'manager', 'employee'] },
  { path: '/stock', label: 'Stock', icon: HiOutlineClipboardList, roles: ['admin'] },
  { path: '/attendance', label: 'Attendance', icon: HiOutlineCalendar, roles: ['admin', 'manager', 'employee', 'hr'] },
  { path: '/salary', label: 'Salary', icon: HiOutlineCurrencyDollar, roles: ['admin', 'hr'] },
  { path: '/collections', label: 'Collections', icon: HiOutlineCollection, roles: ['admin', 'manager', 'hr', 'employee'] },
  { path: '/reports', label: 'Reports', icon: HiOutlineChartBar, roles: ['admin', 'manager', 'hr'] },
  { path: '/audit-logs', label: 'Audit Logs', icon: HiOutlineShieldCheck, roles: ['admin'] },
];

export default function Layout() {
  const { user, logout, updatePasswordChanged, updateProfilePicture } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);

  // Auto-close sidebar whenever the route changes (prevents stuck overlay)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handlePasswordChangeSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setChanging(true);
    try {
      await api.post('/change-password', { new_password: newPassword });
      toast.success('Password configured successfully!');
      updatePasswordChanged();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to change password');
    } finally {
      setChanging(false);
    }
  };

  const navItems = allNavItems.filter(item => item.roles.includes(user?.role));

  if (user?.must_change_password) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-[#F0F6F6] px-4 relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#14A89C]/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#0A373A]/10 rounded-full blur-[120px]" />
        </div>

        <div className="bg-white border border-[#E1ECEB] rounded-2xl p-8 max-w-md w-full shadow-2xl relative z-10 animate-fade-in">
          <div className="text-center mb-6">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-white flex items-center justify-center shadow-xl mb-4 overflow-hidden border border-[#E1ECEB]">
              <img src="/logo.jpg" alt="Shreyansh Vollora Logo" className="w-full h-full object-contain p-1" />
            </div>
            <h1 className="text-2xl font-bold text-[#1A3D40]">SHREYANSH VOLLORA</h1>
            <p className="text-xs text-[#14A89C] font-semibold uppercase tracking-widest mt-1">Every Step GUIDED BY CARE</p>
          </div>

          <div className="bg-[#F0F6F6]/60 border border-[#E1ECEB] rounded-xl p-4 mb-6">
            <h3 className="text-sm font-bold text-[#0A373A] mb-1">🔐 First-time Login Security Check</h3>
            <p className="text-xs text-[#4A6D71] leading-relaxed">
              For your account's safety, you are required to personalize your password before accessing the system.
            </p>
          </div>

          <form onSubmit={handlePasswordChangeSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-[#4A6D71] font-semibold mb-1.5">New Password</label>
              <input 
                type="password" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
                placeholder="Minimum 6 characters"
                className="input-field" 
                required 
              />
            </div>
            <div>
              <label className="block text-sm text-[#4A6D71] font-semibold mb-1.5">Confirm New Password</label>
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                placeholder="Verify new password"
                className="input-field" 
                required 
              />
            </div>

            <button 
              type="submit" 
              disabled={changing}
              className="w-full btn-primary py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold tracking-wide mt-2"
            >
              {changing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving Password...
                </>
              ) : (
                'Configure Secure Password'
              )}
            </button>

            <button 
              type="button" 
              onClick={logout} 
              className="w-full text-sm text-[#4A6D71] hover:text-rose-600 transition-colors font-medium text-center pt-2"
            >
              Go Back & Sign Out
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F0F6F6]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        bg-[#E3EFEF] border-r border-[#D5E5E4] flex flex-col shadow-sm
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-[#D5E5E4]">
          <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-md overflow-hidden">
            <img src="/logo.jpg" alt="Shreyansh Vollora Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#0A373A] tracking-tight">SHREYANSH VOLLORA</h1>
            <p className="text-[10px] text-[#4A6D71] font-semibold uppercase tracking-widest">Management</p>
          </div>
          <button className="lg:hidden ml-auto text-[#4A6D71] hover:text-[#0A373A]" onClick={() => setSidebarOpen(false)}>
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                  ${isActive
                    ? 'bg-[#0A373A] text-white font-semibold shadow-sm'
                    : 'text-[#4A6D71] hover:text-[#0A373A] hover:bg-[#D5E5E4]/50'
                  }
                `}
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-[#4A6D71]'}`} />
                {item.label}
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-[#D5E5E4] p-4">
          <div className="flex items-center gap-3 mb-3">
            {/* Clickable profile picture */}
            <label className="relative cursor-pointer group flex-shrink-0" title="Change profile picture">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) {
                    alert('Image must be under 2MB');
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = async () => {
                    try {
                      await updateProfilePicture(reader.result);
                    } catch {
                      alert('Failed to update photo');
                    }
                  };
                  reader.readAsDataURL(file);
                }}
              />
              <div className="w-9 h-9 rounded-lg overflow-hidden bg-[#0A373A]/10 flex items-center justify-center ring-2 ring-transparent group-hover:ring-[#14A89C] transition-all">
                {user?.profile_picture
                  ? <img src={user.profile_picture} alt="Profile" className="w-full h-full object-cover" />
                  : <span className="text-xs font-bold text-[#0A373A]">{user?.username?.[0]?.toUpperCase()}</span>
                }
              </div>
              {/* Camera overlay on hover */}
              <div className="absolute inset-0 rounded-lg bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </label>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#0A373A] truncate">{user?.username}</p>
              <p className="text-xs text-[#4A6D71] capitalize">{user?.role}</p>
            </div>
            {/* Remove photo button */}
            {user?.profile_picture && (
              <button
                onClick={async () => { try { await updateProfilePicture(null); } catch {} }}
                className="text-[#4A6D71] hover:text-red-500 transition-colors flex-shrink-0"
                title="Remove photo"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-[#4A6D71] hover:text-red-600 hover:bg-red-50/50 transition-all duration-200">
            <HiOutlineLogout className="w-4 h-4" />
            Sign Out
          </button>
        </div>

      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#F0F6F6]">
        {/* Top bar */}
        <header className="bg-[#F0F6F6] border-b border-[#E1ECEB] px-4 sm:px-6 py-3.5 flex items-center gap-4 z-10">
          <button className="lg:hidden text-[#0A373A] hover:text-[#125559]" onClick={() => setSidebarOpen(true)}>
            <HiOutlineMenu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2 bg-white border border-[#D0DFDE] px-3 py-1.5 rounded-full shadow-sm">
            <div className="w-2 h-2 rounded-full bg-[#14A89C] animate-pulse" />
            <span className="text-xs text-[#0A373A] font-medium">System Online</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#F0F6F6]">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
