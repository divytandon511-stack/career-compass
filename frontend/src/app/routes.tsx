import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { RoleGuard } from '@/components/auth/RoleGuard';

import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { DashboardPage } from '@/pages/student/DashboardPage';
import { AssessmentsPage } from '@/pages/student/AssessmentsPage';
import { AssessmentTakePage } from '@/pages/student/AssessmentTakePage';
import { ResultsPage } from '@/pages/student/ResultsPage';
import { RecommendationsPage } from '@/pages/student/RecommendationsPage';
import { CareerExplorerPage } from '@/pages/student/CareerExplorerPage';
import { CareerDetailPage } from '@/pages/student/CareerDetailPage';
import { CounsellorsPage } from '@/pages/student/CounsellorsPage';
import { CounsellorBookPage } from '@/pages/student/CounsellorBookPage';
import { BookingsPage } from '@/pages/student/BookingsPage';
import { GuidancePage } from '@/pages/student/GuidancePage';
import { GuidanceChatPage } from '@/pages/student/GuidanceChatPage';
import { CounsellorDashboardPage } from '@/pages/counsellor/CounsellorDashboardPage';
import { CounsellorSlotsPage } from '@/pages/counsellor/CounsellorSlotsPage';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { AdminCareersPage } from '@/pages/admin/AdminCareersPage';
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage';
import { ForbiddenPage } from '@/pages/ForbiddenPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* 1. Public Pages (Accessible to all guests and authenticated users) */}
      <Route path="/" element={<AppLayout showSidebar={false}><HomePage /></AppLayout>} />
      <Route path="/login" element={<AppLayout showSidebar={false}><LoginPage /></AppLayout>} />
      <Route path="/register" element={<AppLayout showSidebar={false}><RegisterPage /></AppLayout>} />
      <Route path="/careers" element={<AppLayout><CareerExplorerPage /></AppLayout>} />
      <Route path="/careers/:idOrSlug" element={<AppLayout><CareerDetailPage /></AppLayout>} />
      <Route path="/counsellors" element={<AppLayout><CounsellorsPage /></AppLayout>} />

      {/* 2. Student Portal Routes (Protected: requires active auth session + STUDENT role) */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['STUDENT']}>
              <AppLayout><DashboardPage /></AppLayout>
            </RoleGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/assessments"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['STUDENT']}>
              <AppLayout><AssessmentsPage /></AppLayout>
            </RoleGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/assessments/:id/take"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['STUDENT']}>
              <AppLayout showSidebar={false}><AssessmentTakePage /></AppLayout>
            </RoleGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/attempts/:id/results"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['STUDENT']}>
              <AppLayout><ResultsPage /></AppLayout>
            </RoleGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/attempts/:id/recommendations"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['STUDENT']}>
              <AppLayout><RecommendationsPage /></AppLayout>
            </RoleGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/counsellors/:id/book"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['STUDENT']}>
              <AppLayout><CounsellorBookPage /></AppLayout>
            </RoleGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/bookings"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['STUDENT']}>
              <AppLayout><BookingsPage /></AppLayout>
            </RoleGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/guidance"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['STUDENT']}>
              <AppLayout><GuidancePage /></AppLayout>
            </RoleGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/guidance/:sessionId"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['STUDENT']}>
              <AppLayout><GuidanceChatPage /></AppLayout>
            </RoleGuard>
          </ProtectedRoute>
        }
      />

      {/* 3. Counsellor Portal Routes (Protected: requires active auth session + COUNSELLOR role) */}
      <Route
        path="/counsellor/dashboard"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['COUNSELLOR']}>
              <AppLayout><CounsellorDashboardPage /></AppLayout>
            </RoleGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/counsellor/slots"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['COUNSELLOR']}>
              <AppLayout><CounsellorSlotsPage /></AppLayout>
            </RoleGuard>
          </ProtectedRoute>
        }
      />

      {/* 4. Admin Control Center Routes (Protected: requires active auth session + ADMIN role) */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['ADMIN']}>
              <AppLayout><AdminDashboardPage /></AppLayout>
            </RoleGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/careers"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['ADMIN']}>
              <AppLayout><AdminCareersPage /></AppLayout>
            </RoleGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['ADMIN']}>
              <AppLayout><AdminUsersPage /></AppLayout>
            </RoleGuard>
          </ProtectedRoute>
        }
      />

      {/* 5. Error & Fallback Routes */}
      <Route path="/403" element={<AppLayout showSidebar={false}><ForbiddenPage /></AppLayout>} />
      <Route path="*" element={<AppLayout showSidebar={false}><NotFoundPage /></AppLayout>} />
    </Routes>
  );
};
