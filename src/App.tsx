import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import AuthCallback from './pages/AuthCallback';
import LandingPage from './pages/LandingPage';
import AppScreen from './pages/AppScreen';
import AdminScreen from './pages/AdminScreen';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <LandingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/apps/:appId"
        element={
          <ProtectedRoute>
            <AppScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/:section"
        element={
          <ProtectedRoute>
            <AdminScreen />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
