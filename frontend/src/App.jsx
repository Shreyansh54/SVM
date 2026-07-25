import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute from './components/RoleRoute';
import Layout from './components/Layout';
import { Toaster } from 'react-hot-toast';

// ── Lazy-load every page so the initial bundle stays tiny ──
// Only the login page loads eagerly; everything else loads on demand.
const LoginPage        = lazy(() => import('./pages/LoginPage'));
const ResetPasswordPage= lazy(() => import('./pages/ResetPasswordPage'));
const GoogleCallback   = lazy(() => import('./pages/GoogleCallback'));
const Dashboard        = lazy(() => import('./pages/Dashboard'));
const SalesPage        = lazy(() => import('./pages/SalesPage'));
const AttendancePage   = lazy(() => import('./pages/AttendancePage'));
const EmployeesPage    = lazy(() => import('./pages/EmployeesPage'));
const SalaryPage       = lazy(() => import('./pages/SalaryPage'));
const CollectionsPage  = lazy(() => import('./pages/CollectionsPage'));
const ReportsPage      = lazy(() => import('./pages/ReportsPage'));
const AuditLogsPage    = lazy(() => import('./pages/AuditLogsPage'));
const ProductsPage     = lazy(() => import('./pages/ProductsPage'));
const BatchesPage      = lazy(() => import('./pages/BatchesPage'));
const StockPage        = lazy(() => import('./pages/StockPage'));
const StockistsPage    = lazy(() => import('./pages/StockistsPage'));
const DoctorsPage      = lazy(() => import('./pages/DoctorsPage'));

// ── Minimal full-screen spinner shown while a page chunk loads ──
function PageLoader() {
  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#F5FAFA', zIndex: 9999
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: '3px solid #E1ECEB', borderTopColor: '#14A89C',
        animation: 'spin 0.7s linear infinite'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' },
            success: { iconTheme: { primary: '#10b981', secondary: '#f1f5f9' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#f1f5f9' } },
          }}
        />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login"          element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/auth/callback"  element={<GoogleCallback />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="sales"      element={<SalesPage />} />
              <Route path="attendance" element={<AttendancePage />} />

              <Route path="employees"  element={<RoleRoute allowedRoles={['admin','hr']}><EmployeesPage /></RoleRoute>} />
              <Route path="salary"     element={<RoleRoute allowedRoles={['admin','hr']}><SalaryPage /></RoleRoute>} />
              <Route path="collections"element={<RoleRoute allowedRoles={['admin','manager','hr','employee']}><CollectionsPage /></RoleRoute>} />
              <Route path="reports"    element={<RoleRoute allowedRoles={['admin','manager','hr']}><ReportsPage /></RoleRoute>} />
              <Route path="audit-logs" element={<RoleRoute allowedRoles={['admin']}><AuditLogsPage /></RoleRoute>} />
              <Route path="products"   element={<RoleRoute allowedRoles={['admin']}><ProductsPage /></RoleRoute>} />
              <Route path="batches"    element={<RoleRoute allowedRoles={['admin']}><BatchesPage /></RoleRoute>} />
              <Route path="stock"      element={<RoleRoute allowedRoles={['admin']}><StockPage /></RoleRoute>} />
              <Route path="stockists"  element={<RoleRoute allowedRoles={['admin','manager']}><StockistsPage /></RoleRoute>} />
              <Route path="doctors"    element={<RoleRoute allowedRoles={['admin','manager','employee']}><DoctorsPage /></RoleRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </Router>
  );
}
