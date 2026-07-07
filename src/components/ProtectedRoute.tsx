import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth';

/** Gates a route behind authentication; bounces to /login otherwise. */
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
