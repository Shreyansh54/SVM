import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import api from '../api';

export default function LoginPage() {
  const [mode, setMode] = useState('login'); // 'login', 'register', 'forgot'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('employee');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'register') {
        await register(username, password, role);
        toast.success('Account created! Please login.');
        setMode('login');
      } else if (mode === 'login') {
        await login(username, password);
        toast.success('Welcome back!');
        navigate('/');
      } else if (mode === 'forgot') {
        const res = await api.post('/forgot-password', { 
          username: username || null,
          email: email || null
        });
        toast.success(res.data.message || 'Password reset link sent to your registered email!');
        if (res.data.dev_link) console.log("Password Reset Link (Dev):", res.data.dev_link);
        setMode('login');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F0F6F6] px-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#14A89C]/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#0A373A]/10 rounded-full blur-[120px]" />
      </div>

      <div className="card w-full max-w-md animate-fade-in relative bg-white border border-[#E1ECEB] shadow-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-white flex items-center justify-center shadow-xl mb-4 animate-pulse-glow overflow-hidden border border-[#E1ECEB]">
            <img src="/logo.jpg" alt="Shreyansh Vollora Logo" className="w-full h-full object-contain p-1" />
          </div>
          <h1 className="text-2xl font-bold text-[#1A3D40]">SHREYANSH VOLLORA</h1>
          <p className="text-sm text-[#5B7F83] mt-1 font-semibold tracking-wide">Every Step GUIDED BY CARE</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#4A6D71] mb-1.5">Username</label>
            <input id="login-username" type="text" value={username} onChange={e => setUsername(e.target.value)}
              className="input-field" placeholder="Enter username" required={mode !== 'forgot'} />
          </div>

          {mode !== 'forgot' ? (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-medium text-[#4A6D71]">Password</label>
                {mode === 'login' && (
                  <button type="button" onClick={() => setMode('forgot')}
                    className="text-xs text-[#0A373A] hover:text-[#125559] font-semibold transition-colors">
                    Forgot Password?
                  </button>
                )}
              </div>
              <input id="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="input-field" placeholder="Enter password" required />
            </div>
          ) : (
            <div className="space-y-3 animate-fade-in">
              <div className="bg-[#F0F6F6]/60 border border-[#E1ECEB] rounded-xl p-3">
                <p className="text-xs text-[#4A6D71] leading-relaxed">
                  📧 Enter your <strong>username</strong> or <strong>registered email address</strong> to receive a password reset link.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4A6D71] mb-1.5">Email Address (Registered)</label>
                <input id="forgot-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="input-field" placeholder="e.g. sumedha.mishra123@gmail.com" />
              </div>
            </div>
          )}

          {mode === 'register' && (
            <div className="animate-fade-in">
              <label className="block text-sm font-medium text-[#4A6D71] mb-1.5">Role</label>
              <select id="register-role" value={role} onChange={e => setRole(e.target.value)} className="select-field">
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="hr">HR</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          )}

          <button id="login-submit" type="submit" disabled={loading} className="btn-primary w-full !py-3 text-sm">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              mode === 'register' ? 'Create Account' : mode === 'forgot' ? 'Send Reset Link' : 'Sign In'
            )}
          </button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-3">
          {mode === 'login' && (
            <>
              {/* Divider */}
              <div className="flex items-center w-full gap-3">
                <div className="flex-1 h-px bg-[#E1ECEB]" />
                <span className="text-xs text-[#4A6D71] font-medium">or</span>
                <div className="flex-1 h-px bg-[#E1ECEB]" />
              </div>

              {/* Google Sign-In */}
              <a
                href={
                  import.meta.env.VITE_API_URL
                    ? `${import.meta.env.VITE_API_URL}/auth/google`
                    : '/api/auth/google'
                }
                className="flex items-center justify-center gap-3 w-full border border-[#D5E5E4] bg-white hover:bg-[#F7FAFA] text-[#1A3D40] text-sm font-semibold py-2.5 px-4 rounded-xl transition-all duration-200 shadow-sm hover:shadow"
              >
                {/* Google G icon */}
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </a>
            </>
          )}

          {mode === 'forgot' ? (
            <button onClick={() => setMode('login')}
              className="text-sm text-[#0A373A] hover:text-[#125559] font-semibold transition-colors">
              Back to Sign In
            </button>
          ) : (
            <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-sm text-[#0A373A] hover:text-[#125559] font-semibold transition-colors">
              {mode === 'register' ? 'Already have an account? Sign in' : "Don't have an account? Register"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
