import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types/models';

export interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const { user, authUser, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '40vh',
        }}
      >
        <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
          Validating authorization permissions...
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const currentRole = user?.role || authUser?.role;

  if (!currentRole || !allowedRoles.includes(currentRole)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
};
