import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import AuthCallback from './pages/AuthCallback';
import LandingPage from './pages/LandingPage';
import AppScreen from './pages/AppScreen';
import AdminScreen from './pages/AdminScreen';
import UseCasesList from './pages/qastudio/UseCasesList';
import UseCaseDetail from './pages/qastudio/UseCaseDetail';
import TemplatesList from './pages/qastudio/TemplatesList';
import TemplateDetail from './pages/qastudio/TemplateDetail';
import SuitesList from './pages/qastudio/SuitesList';
import SuiteDetail from './pages/qastudio/SuiteDetail';
import UsersAdmin from './pages/admin/UsersAdmin';
import GroupsAdmin from './pages/admin/GroupsAdmin';
import AuditLogs from './pages/admin/AuditLogs';
import TokensSettings from './pages/settings/TokensSettings';

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
        path="/apps/qa-studio/usecases"
        element={
          <ProtectedRoute>
            <UseCasesList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/apps/qa-studio/usecases/:id"
        element={
          <ProtectedRoute>
            <UseCaseDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/apps/qa-studio/templates"
        element={
          <ProtectedRoute>
            <TemplatesList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/apps/qa-studio/templates/:id"
        element={
          <ProtectedRoute>
            <TemplateDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/apps/qa-studio/suites"
        element={
          <ProtectedRoute>
            <SuitesList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/apps/qa-studio/suites/:id"
        element={
          <ProtectedRoute>
            <SuiteDetail />
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
        path="/settings/tokens"
        element={
          <ProtectedRoute>
            <TokensSettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute>
            <UsersAdmin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/groups"
        element={
          <ProtectedRoute>
            <GroupsAdmin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/audit"
        element={
          <ProtectedRoute>
            <AuditLogs />
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
