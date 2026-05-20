import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute from './components/RoleRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import EmployeesPage from './pages/EmployeesPage';
import StockistsPage from './pages/StockistsPage';
import ProductsPage from './pages/ProductsPage';
import SalesPage from './pages/SalesPage';
import StockPage from './pages/StockPage';
import AttendancePage from './pages/AttendancePage';
import SalaryPage from './pages/SalaryPage';
import ReportsPage from './pages/ReportsPage';
import DoctorsPage from './pages/DoctorsPage';
import BatchesPage from './pages/BatchesPage';
import AuditLogsPage from './pages/AuditLogsPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import { Toaster } from 'react-hot-toast';

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' },
            success: { iconTheme: { primary: '#10b981', secondary: '#f1f5f9' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#f1f5f9' } },
          }}
        />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="sales" element={<SalesPage />} />
            <Route path="attendance" element={<AttendancePage />} />
            
            {/* Role protected routes using robust RoleRoute */}
            <Route path="employees" element={<RoleRoute allowedRoles={['admin', 'hr']}><EmployeesPage /></RoleRoute>} />
            <Route path="salary" element={<RoleRoute allowedRoles={['admin', 'hr']}><SalaryPage /></RoleRoute>} />
            <Route path="reports" element={<RoleRoute allowedRoles={['admin', 'manager', 'hr']}><ReportsPage /></RoleRoute>} />
            <Route path="audit-logs" element={<RoleRoute allowedRoles={['admin']}><AuditLogsPage /></RoleRoute>} />
            
            <Route path="products" element={<RoleRoute allowedRoles={['admin']}><ProductsPage /></RoleRoute>} />
            <Route path="batches" element={<RoleRoute allowedRoles={['admin']}><BatchesPage /></RoleRoute>} />
            <Route path="stock" element={<RoleRoute allowedRoles={['admin']}><StockPage /></RoleRoute>} />
            
            <Route path="stockists" element={<RoleRoute allowedRoles={['admin', 'manager']}><StockistsPage /></RoleRoute>} />
            <Route path="doctors" element={<RoleRoute allowedRoles={['admin', 'manager']}><DoctorsPage /></RoleRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
