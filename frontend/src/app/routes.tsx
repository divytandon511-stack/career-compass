import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';

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
      {/* Public Pages */}
      <Route path="/" element={<AppLayout showSidebar={false}><HomePage /></AppLayout>} />
      <Route path="/login" element={<AppLayout showSidebar={false}><LoginPage /></AppLayout>} />
      <Route path="/register" element={<AppLayout showSidebar={false}><RegisterPage /></AppLayout>} />
      <Route path="/careers" element={<AppLayout><CareerExplorerPage /></AppLayout>} />
      <Route path="/careers/:idOrSlug" element={<AppLayout><CareerDetailPage /></AppLayout>} />
      <Route path="/counsellors" element={<AppLayout><CounsellorsPage /></AppLayout>} />

      {/* Student Portal Routes */}
      <Route path="/dashboard" element={<AppLayout><DashboardPage /></AppLayout>} />
      <Route path="/assessments" element={<AppLayout><AssessmentsPage /></AppLayout>} />
      <Route path="/assessments/:id/take" element={<AppLayout showSidebar={false}><AssessmentTakePage /></AppLayout>} />
      <Route path="/attempts/:id/results" element={<AppLayout><ResultsPage /></AppLayout>} />
      <Route path="/attempts/:id/recommendations" element={<AppLayout><RecommendationsPage /></AppLayout>} />
      <Route path="/counsellors/:id/book" element={<AppLayout><CounsellorBookPage /></AppLayout>} />
      <Route path="/bookings" element={<AppLayout><BookingsPage /></AppLayout>} />
      <Route path="/guidance" element={<AppLayout><GuidancePage /></AppLayout>} />
      <Route path="/guidance/:sessionId" element={<AppLayout><GuidanceChatPage /></AppLayout>} />

      {/* Counsellor Portal Routes */}
      <Route path="/counsellor/dashboard" element={<AppLayout><CounsellorDashboardPage /></AppLayout>} />
      <Route path="/counsellor/slots" element={<AppLayout><CounsellorSlotsPage /></AppLayout>} />

      {/* Admin Control Center Routes */}
      <Route path="/admin/dashboard" element={<AppLayout><AdminDashboardPage /></AppLayout>} />
      <Route path="/admin/careers" element={<AppLayout><AdminCareersPage /></AppLayout>} />
      <Route path="/admin/users" element={<AppLayout><AdminUsersPage /></AppLayout>} />

      {/* Error & Fallback Routes */}
      <Route path="/403" element={<AppLayout showSidebar={false}><ForbiddenPage /></AppLayout>} />
      <Route path="*" element={<AppLayout showSidebar={false}><NotFoundPage /></AppLayout>} />
    </Routes>
  );
};
