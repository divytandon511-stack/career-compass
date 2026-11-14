import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/shared/Button';
import { SkeletonLoader } from '@/components/shared/SkeletonLoader';
import { RadarChart } from '@/components/student/RadarChart';
import { WelcomeAssessmentCard } from '@/components/student/WelcomeAssessmentCard';
import { userApi } from '@/services/api/user.api';
import { assessmentApi } from '@/services/api/assessment.api';
import { careersApi } from '@/services/api/careers.api';
import { bookingApi } from '@/services/api/booking.api';
import {
  UserProfile,
  AssessmentAttempt,
  Recommendation,
  SavedCareer,
  Booking,
} from '@/types/models';

export const DashboardPage: React.FC = () => {
  const { user: contextUser } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(contextUser);
  const [attempts, setAttempts] = useState<AssessmentAttempt[]>([]);
  const [latestCompletedAttempt, setLatestCompletedAttempt] = useState<AssessmentAttempt | null>(null);
  const [topRecommendation, setTopRecommendation] = useState<Recommendation | null>(null);
  const [savedCareers, setSavedCareers] = useState<SavedCareer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errors, setErrors] = useState<{
    profile?: string;
    attempts?: string;
    scores?: string;
    recommendations?: string;
    saved?: string;
    bookings?: string;
  }>({});

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      setIsLoading(true);
      setErrors({});

      // 1. Concurrently fetch profile, attempts, saved careers, and bookings via Promise.allSettled
      const [profileRes, attemptsRes, savedRes, bookingsRes] = await Promise.allSettled([
        userApi.getProfile(),
        assessmentApi.listAttempts({ limit: 10, sort: 'startedAt', order: 'desc' }),
        careersApi.getSavedCareers({ limit: 5 }),
        bookingApi.getMyBookings({ limit: 5, sort: 'startsAt', order: 'asc' }),
      ]);

      if (!isMounted) return;

      const newErrors: Record<string, string> = {};

      // Profile resolution
      if (profileRes.status === 'fulfilled') {
        setProfile(profileRes.value.data);
      } else {
        newErrors.profile = 'Unable to refresh student profile details.';
      }

      // Saved careers resolution
      if (savedRes.status === 'fulfilled') {
        setSavedCareers(savedRes.value.data || []);
      } else {
        newErrors.saved = 'Unable to load bookmarked careers.';
      }

      // Bookings resolution
      if (bookingsRes.status === 'fulfilled') {
        setBookings(bookingsRes.value.data || []);
      } else {
        newErrors.bookings = 'Unable to load counsellor bookings.';
      }

      // Attempts resolution
      let completedCandidate: AssessmentAttempt | null = null;
      if (attemptsRes.status === 'fulfilled') {
        const attemptList = attemptsRes.value.data || [];
        setAttempts(attemptList);

        // Find the latest completed attempt — never assume the first index is completed
        completedCandidate = attemptList.find((a) => a.status === 'COMPLETED') || null;
      } else {
        newErrors.attempts = 'Unable to load assessment history.';
      }

      // If a completed attempt was found, fetch its full dimension scores and top recommendation
      if (completedCandidate) {
        const [detailRes, recsRes] = await Promise.allSettled([
          assessmentApi.getAttempt(completedCandidate.id),
          assessmentApi.getRecommendations(completedCandidate.id, 1, 1),
        ]);

        if (isMounted) {
          if (detailRes.status === 'fulfilled') {
            setLatestCompletedAttempt(detailRes.value.data);
          } else {
            setLatestCompletedAttempt(completedCandidate);
            newErrors.scores = 'Unable to load full dimension score details.';
          }

          if (recsRes.status === 'fulfilled') {
            const recList = recsRes.value.data || [];
            setTopRecommendation(recList.length > 0 ? recList[0] : null);
          } else {
            newErrors.recommendations = 'Unable to load recommendation blueprint.';
          }
        }
      } else {
        setLatestCompletedAttempt(null);
        setTopRecommendation(null);
      }

      setErrors(newErrors);
      setIsLoading(false);
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  const studentName = profile?.displayName || contextUser?.displayName || 'Student';
  const studentProfile = profile?.profile && 'schoolGrade' in profile.profile ? profile.profile : null;
  const schoolGrade = studentProfile?.schoolGrade || 'Secondary';
  const hasCompletedAssessment = Boolean(latestCompletedAttempt && latestCompletedAttempt.scoresJson);

  // Filter upcoming confirmed bookings
  const now = new Date();
  const upcomingBookings = bookings.filter((b) => {
    if (b.status === 'CANCELLED') return false;
    if (b.startsAt) {
      const startTime = new Date(b.startsAt);
      return !isNaN(startTime.getTime()) && startTime >= now;
    }
    return b.status === 'CONFIRMED';
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Personalized Welcome Header */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15))',
          border: '1px solid rgba(99, 102, 241, 0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '4px',
              }}
            >
              Student Guidance Hub • Grade {schoolGrade}
            </div>
            <h1 style={{ fontSize: '1.75rem' }}>Welcome back, {studentName}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
              Account: {profile?.email || contextUser?.email || ''} • Status: {profile?.status || 'ACTIVE'} • Recorded Explorations: {attempts.length}
            </p>
          </div>
          <Button onClick={() => navigate('/assessments')}>
            Take Interest Assessment →
          </Button>
        </div>
      </div>

      {/* Partial Errors Banner (Non-blocking resilience) */}
      {Object.keys(errors).length > 0 && (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            borderLeft: '4px solid var(--warning)',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            color: 'var(--text-main)',
          }}
        >
          <strong>Notice:</strong> Some dashboard modules could not be updated ({Object.values(errors).join(' ')}).
        </div>
      )}

      {/* 2. First-Time Assessment Onboarding Card (Empty State) */}
      {!isLoading && !hasCompletedAssessment && (
        <WelcomeAssessmentCard studentName={studentName} />
      )}

      {/* 3. Main Dashboard Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
        {/* Radar Chart / Interest Dimension Profile Card */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <h3>Interest Profile</h3>
            {latestCompletedAttempt && (
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>
                Attempt v{latestCompletedAttempt.assessmentVersion || '1'}
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: 'var(--space-4)' }}>
            Self-reported preference profile across the six NEP 2020 interest dimensions.
          </p>

          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-6) 0' }}>
              <SkeletonLoader height="220px" borderRadius="var(--radius-md)" />
              <SkeletonLoader height="20px" width="60%" />
            </div>
          ) : (
            <RadarChart scores={latestCompletedAttempt?.scoresJson} size={280} />
          )}

          <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', lineHeight: 1.4 }}>
              * Dimension scores range from 0.00 to 1.00 based on verified mathematical weighting.
            </span>
          </div>
        </div>

        {/* Top Algorithmic Recommendation & Summary Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <h3>Top Aligned Career</h3>
              {topRecommendation && (
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'rgba(6, 182, 212, 0.15)',
                    color: 'var(--secondary)',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  Rank #{topRecommendation.rank}
                </span>
              )}
            </div>

            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4) 0' }}>
                <SkeletonLoader height="24px" width="70%" />
                <SkeletonLoader height="40px" />
                <SkeletonLoader height="60px" />
              </div>
            ) : topRecommendation ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div>
                  <h4 style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>
                    {topRecommendation.career?.title || 'Curated Career'}
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        color: 'var(--primary)',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}
                    >
                      {Math.round(topRecommendation.similarityScore * 100)}% Similarity
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                      Vector Alignment (Cosine Score: {topRecommendation.similarityScore.toFixed(3)})
                    </span>
                  </div>
                </div>

                {topRecommendation.reasons && topRecommendation.reasons.length > 0 && (
                  <div style={{ backgroundColor: 'var(--bg-base)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--success)', display: 'block', marginBottom: '4px' }}>
                      Key Alignment Factors:
                    </span>
                    <ul style={{ paddingLeft: '18px', fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                      {topRecommendation.reasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {topRecommendation.cautions && topRecommendation.cautions.length > 0 && (
                  <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.05)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--warning)', display: 'block', marginBottom: '2px' }}>
                      Consideration Note:
                    </span>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                      {topRecommendation.cautions[0]}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
                Complete an assessment exploration to generate deterministic vector career recommendations.
              </div>
            )}
          </div>

          <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)' }}>
            {topRecommendation?.career?.slug && (
              <Button size="sm" variant="secondary" onClick={() => navigate(`/careers/${topRecommendation.career.slug}`)}>
                View Pathway Blueprint →
              </Button>
            )}
            {latestCompletedAttempt && (
              <Button size="sm" variant="outline" onClick={() => navigate(`/attempts/${latestCompletedAttempt.id}/recommendations`)}>
                All Recommendations
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Second Grid: Saved Careers & Upcoming Bookings */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
        {/* Saved Careers List Card */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <h3>Saved Careers</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {savedCareers.length} bookmarked
            </span>
          </div>

          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <SkeletonLoader height="36px" />
              <SkeletonLoader height="36px" />
            </div>
          ) : savedCareers.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {savedCareers.map((saved) => (
                <div
                  key={saved.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-base)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', display: 'block' }}>
                      {saved.title}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                      Saved on {new Date(saved.savedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/careers/${saved.slug}`)}>
                    View
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--text-dim)', padding: 'var(--space-4) 0' }}>
              No careers bookmarked yet. Browse the Career Explorer to save interesting pathways.
            </p>
          )}

          <div style={{ marginTop: 'var(--space-4)' }}>
            <Button size="sm" variant="secondary" onClick={() => navigate('/careers')}>
              Browse Career Explorer
            </Button>
          </div>
        </div>

        {/* Upcoming Guidance Sessions Card */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <h3>Upcoming Guidance Appointments</h3>
            <Button size="sm" variant="outline" onClick={() => navigate('/counsellors')}>
              Book Session
            </Button>
          </div>

          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <SkeletonLoader height="36px" />
              <SkeletonLoader height="36px" />
            </div>
          ) : upcomingBookings.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {upcomingBookings.map((b) => (
                <div
                  key={b.id}
                  style={{
                    padding: '10px 12px',
                    backgroundColor: 'var(--bg-base)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>
                      Session ID: {b.id.substring(0, 8)}...
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        color: 'var(--success)',
                        fontWeight: 700,
                      }}
                    >
                      {b.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {b.startsAt
                      ? `Date: ${new Date(b.startsAt).toLocaleString()}`
                      : 'Time pending confirmation'}
                  </div>
                  {b.note && (
                    <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px', fontStyle: 'italic' }}>
                      Note: "{b.note}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--text-dim)', padding: 'var(--space-4) 0' }}>
              No upcoming counsellor appointments scheduled. Select a verified advisor to reserve a slot.
            </p>
          )}

          <div style={{ marginTop: 'var(--space-4)' }}>
            <Button size="sm" variant="secondary" onClick={() => navigate('/bookings')}>
              Manage All Bookings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
