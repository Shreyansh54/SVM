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
        const res = await api.post('/forgot-password', { username });
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
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#0A373A] to-[#14A89C] flex items-center justify-center shadow-xl mb-4 animate-pulse-glow">
            <span className="text-xl font-bold text-[#1A3D40]">SV</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1A3D40]">SHREYANSH VOLLORA</h1>
          <p className="text-sm text-[#5B7F83] mt-1 font-semibold tracking-wide">Every Step GUIDED BY CARE</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#4A6D71] mb-1.5">Username</label>
            <input id="login-username" type="text" value={username} onChange={e => setUsername(e.target.value)}
              className="input-field" placeholder="Enter username" required />
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
            <div className="bg-[#F0F6F6]/60 border border-[#E1ECEB] rounded-xl p-4 animate-fade-in">
              <p className="text-xs text-[#4A6D71] leading-relaxed">
                📧 A password reset link will be automatically sent to the email address registered with your employee profile.
              </p>
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
