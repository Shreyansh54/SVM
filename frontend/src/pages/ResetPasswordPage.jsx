import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      toast.error('Invalid or missing reset token.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/reset-password', { token, password });
      toast.success('Password reset successfully! Please sign in.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Reset failed. Token might be expired.');
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
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#0A373A] to-[#14A89C] flex items-center justify-center shadow-xl mb-4">
            <span className="text-xl font-bold text-[#1A3D40]">SV</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1A3D40]">Reset Password</h1>
          <p className="text-sm text-[#5B7F83] mt-1">Enter your new secure password below</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#4A6D71] mb-1.5">New Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="input-field" placeholder="Enter new password" required minLength={6} />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#4A6D71] mb-1.5">Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              className="input-field" placeholder="Confirm new password" required minLength={6} />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full !py-3 text-sm">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              'Reset Password'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button onClick={() => navigate('/login')}
            className="text-sm text-[#0A373A] hover:text-[#125559] font-semibold transition-colors">
            Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
