import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/login', { username, password });
    const { access_token, role, employee_id, must_change_password, profile_picture } = res.data;
    localStorage.setItem('token', access_token);
    const userData = { username, role, employee_id, must_change_password, profile_picture };
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const register = async (username, password, role) => {
    await api.post('/register', { username, password, role });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const updatePasswordChanged = () => {
    if (user) {
      const updated = { ...user, must_change_password: false };
      localStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
    }
  };

  const updateProfilePicture = async (base64Image) => {
    const res = await api.put('/profile-picture', { profile_picture: base64Image });
    const updated = { ...user, profile_picture: res.data.profile_picture };
    localStorage.setItem('user', JSON.stringify(updated));
    setUser(updated);
  };

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isEmployee = user?.role === 'employee';

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, isAdmin, isManager, isEmployee, updatePasswordChanged, updateProfilePicture }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
