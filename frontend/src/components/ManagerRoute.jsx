import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ManagerRoute({ children }) {
  const { user } = useAuth();

  if (user?.role !== 'admin' && user?.role !== 'manager') {
    return <Navigate to="/" replace />;
  }

  return children;
}
