import React, { useEffect, useState } from 'react';
import { adminApi } from '@/services/api/admin.api';
import { OverviewAnalytics, CareerInterestAnalytic } from '@/types/models';
import { DIMENSION_DETAILS, Dimension } from '@/types/dimensions';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/shared/Button';

export const AdminDashboardPage: React.FC = () => {
  const [overview, setOverview] = useState<OverviewAnalytics | null>(null);
  const [interests, setInterests] = useState<CareerInterestAnalytic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [overviewRes, interestsRes] = await Promise.all([
        adminApi.getOverviewAnalytics(),
        adminApi.getCareerInterestAnalytics(),
      ]);
      setOverview(overviewRes.data);
      setInterests(interestsRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load school analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const maxTotal = interests.reduce((acc, cur) => Math.max(acc, cur.total), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Administrative Console
        </span>
        <h2>School Administration & Analytics Hub</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Privacy-preserving aggregate metrics with k-anonymity suppression (k ≥ 5) for secondary school career guidance cohorts.
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          style={{
            padding: 'var(--space-4)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--danger)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{error}</span>
          <Button size="sm" variant="secondary" onClick={loadData}>Retry</Button>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {/* Overview KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
            <div className="card">
              <span style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                Total Accounts
              </span>
              <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px', color: 'var(--primary)' }}>
                {overview?.users ?? 0}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Students, counsellors & staff</span>
            </div>

            <div className="card">
              <span style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                Completed Assessments
              </span>
              <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px', color: 'var(--success)' }}>
                {overview?.completedAttempts ?? 0}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {overview?.attempts ?? 0} total attempts initiated
              </span>
            </div>

            <div className="card">
              <span style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                Guidance Bookings
              </span>
              <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px', color: 'var(--secondary)' }}>
                {overview?.bookings ?? 0}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>One-on-one sessions</span>
            </div>

            <div className="card">
              <span style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                Published Careers
              </span>
              <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px', color: 'var(--warning)' }}>
                {overview?.publishedCareers ?? 0}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Active in career explorer</span>
            </div>
          </div>

          {/* Aggregate Interest Dimension Distribution */}
          <div className="card">
            <h3 style={{ marginBottom: 'var(--space-2)' }}>School Cohort Interest Distribution</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: 'var(--space-6)' }}>
              Distribution of expressed interest traits across all scored student assessments.
            </p>

            {interests.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', fontSize: '13px' }}>
                No cohort assessment data available yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {interests.map((item) => {
                  const dimKey = item.dimension as Dimension;
                  const dimInfo = DIMENSION_DETAILS[dimKey] || {
                    label: item.dimension,
                    color: 'var(--primary)',
                    description: '',
                  };
                  const percentage = Math.round((item.total / maxTotal) * 100);

                  return (
                    <div key={item.dimension}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              backgroundColor: dimInfo.color,
                              display: 'inline-block',
                            }}
                          />
                          <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                            {dimInfo.label}
                          </strong>
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                          {item.total} {item.total === 1 ? 'student' : 'students'}
                        </span>
                      </div>

                      <div
                        style={{
                          width: '100%',
                          height: '10px',
                          backgroundColor: 'var(--bg-base)',
                          borderRadius: '999px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${percentage}%`,
                            height: '100%',
                            backgroundColor: dimInfo.color,
                            borderRadius: '999px',
                            transition: 'width 0.5s ease',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Privacy & Compliance Notice */}
          <div
            className="card"
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.05)',
              borderLeft: '4px solid var(--warning)',
            }}
          >
            <h4 style={{ marginBottom: 'var(--space-2)', color: 'var(--text-main)', fontSize: '14px' }}>
              🔒 Privacy-Preserving Aggregate Notice (k-Anonymity)
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
              In compliance with MoE guidelines and NEP 2020 privacy benchmarks, student cohort data is strictly aggregated. Any subgroup with fewer than 5 respondents (k &lt; 5) is suppressed from demographic breakdowns to guarantee complete deanonymization protection.
            </p>
          </div>
        </>
      )}
    </div>
  );
};
