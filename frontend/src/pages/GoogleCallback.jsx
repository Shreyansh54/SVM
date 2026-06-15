import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function GoogleCallback() {
  const [params] = useSearchParams();
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    const role = params.get('role');
    const username = params.get('username');
    const employee_id = params.get('employee_id');
    const error = params.get('error');

    if (error) {
      navigate('/login?error=' + error);
      return;
    }

    if (token && username) {
      loginWithToken({ token, username, role, employee_id: employee_id || null });
      navigate('/');
    } else {
      navigate('/login');
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#F0F6F6] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#14A89C] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#4A6D71] font-medium">Signing you in with Google...</p>
      </div>
    </div>
  );
}
