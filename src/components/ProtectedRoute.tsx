import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  
  console.log('=== ProtectedRoute Check ===', { 
    user: !!user, 
    loading, 
    pathname: window.location.pathname 
  });

  if (loading) {
    console.log('ProtectedRoute: Still loading auth state');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    console.log('ProtectedRoute: No user found, redirecting to /auth');
    return <Navigate to="/auth" replace />;
  }

  console.log('ProtectedRoute: User authenticated, rendering children');
  return <>{children}</>;
};