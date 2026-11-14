import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { careersApi } from '@/services/api/careers.api';
import { adminApi, CreateCareerPayload } from '@/services/api/admin.api';
import { Career } from '@/types/models';
import { CANONICAL_DIMENSIONS, Dimension, DIMENSION_DETAILS } from '@/types/dimensions';
import { Button } from '@/components/shared/Button';
import { InputField } from '@/components/shared/InputField';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export const AdminCareersPage: React.FC = () => {
  const [careers, setCareers] = useState<Career[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Career modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [dimensionProfile, setDimensionProfile] = useState<Record<Dimension, number>>({
    ANALYTICAL: 0.8,
    CREATIVE: 0.2,
    SOCIAL: 0.2,
    PRACTICAL: 0.4,
    ORGANIZATIONAL: 0.5,
    INVESTIGATIVE: 0.7,
  });
  const [creating, setCreating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const fetchCareers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await careersApi.listCareers({ limit: 100 });
      setCareers(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load career catalogue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCareers();
  }, [fetchCareers]);

  const handleCreateCareer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) {
      setModalError('Title and slug are required.');
      return;
    }

    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(slug.trim())) {
      setModalError('Slug must contain only lowercase letters, numbers, and single hyphens (e.g. "software-architect").');
      return;
    }

    const hasNonZeroDimension = Object.values(dimensionProfile).some((val) => val > 0);
    if (!hasNonZeroDimension) {
      setModalError('At least one dimension profile weight must be greater than 0.');
      return;
    }

    try {
      setCreating(true);
      setModalError(null);
      const payload: CreateCareerPayload = {
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        dimensionProfile,
        skillIds: [],
        pathways: [],
      };
      const res = await adminApi.createCareer(payload);
      if (res.data) {
        setCareers((prev) => [res.data, ...prev]);
      }
      setShowAddModal(false);
      setTitle('');
      setSlug('');
      setDescription('');
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to create career');
    } finally {
      setCreating(false);
    }
  };

  const handleArchiveCareer = async (career: Career) => {
    if (!window.confirm(`Are you sure you want to unpublish / archive "${career.title}"?`)) {
      return;
    }

    try {
      setArchivingId(career.id);
      await adminApi.archiveCareer(career.id);
      setCareers((prev) => prev.filter((c) => c.id !== career.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to archive career');
    } finally {
      setArchivingId(null);
    }
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slug || slug === title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Catalogue Management
          </span>
          <h2>Career Catalogue Management</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Curate verified career roadmaps, define 6-dimension interest target vectors, and manage student exploration pathways.
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          + Add New Career
        </Button>
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
          <Button size="sm" variant="secondary" onClick={fetchCareers}>Retry</Button>
        </div>
      )}

      {/* Main Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <LoadingSpinner />
        </div>
      ) : careers.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <div style={{ fontSize: '36px', marginBottom: 'var(--space-2)' }}>💼</div>
          <h3>No Careers in Catalogue</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: 'var(--space-2)' }}>
            The official catalogue has no published careers yet. Add a new career entry to make it visible to students.
          </p>
          <Button onClick={() => setShowAddModal(true)} style={{ marginTop: 'var(--space-4)' }}>
            + Create First Career
          </Button>
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-base)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Career Title / Slug</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Primary Traits</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {careers.map((career) => (
                <tr key={career.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{career.title}</div>
                    <code style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{career.slug}</code>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {career.dimensions && career.dimensions.length > 0 ? (
                        career.dimensions
                          .filter((d) => d.targetWeight > 0.4)
                          .map((d) => (
                            <span
                              key={d.dimension}
                              style={{
                                fontSize: '11px',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'var(--bg-base)',
                                border: '1px solid var(--border-subtle)',
                                color: DIMENSION_DETAILS[d.dimension]?.color || 'var(--text-main)',
                                fontWeight: 600,
                              }}
                            >
                              {d.dimension.slice(0, 4)}: {d.targetWeight.toFixed(1)}
                            </span>
                          ))
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>Unprofiled</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: career.published !== false ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: career.published !== false ? 'var(--success)' : 'var(--danger)',
                      }}
                    >
                      {career.published !== false ? 'Published' : 'Archived'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                      <Link
                        to={`/careers/${career.slug}`}
                        style={{
                          fontSize: '12px',
                          color: 'var(--primary)',
                          textDecoration: 'none',
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        View
                      </Link>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={archivingId === career.id}
                        onClick={() => handleArchiveCareer(career)}
                      >
                        {archivingId === career.id ? 'Archiving...' : 'Archive'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add New Career Modal */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="career-modal-title"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '640px',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: 'var(--bg-surface)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 id="career-modal-title" style={{ margin: 0 }}>Add New Career Roadmap</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div
                role="alert"
                style={{
                  padding: 'var(--space-3)',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid var(--danger)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--danger)',
                  fontSize: '13px',
                  marginBottom: 'var(--space-4)',
                }}
              >
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateCareer} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <InputField
                label="Career Title"
                placeholder="e.g. Data Scientist & Machine Learning Engineer"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                required
              />

              <InputField
                label="URL Slug (lowercase letters and hyphens)"
                placeholder="e.g. data-scientist"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                <label htmlFor="career-desc" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                  Description & Overview
                </label>
                <textarea
                  id="career-desc"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Overview of duties, educational prerequisites, and industry scope..."
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-base)',
                    color: 'var(--text-main)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* 6 Dimension Target Weights */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: 'var(--space-2)' }}>
                  Dimension Profile Weights (0.0 to 1.0)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
                  {CANONICAL_DIMENSIONS.map((dim: Dimension) => {
                    const dimVal = dimensionProfile[dim] ?? 0;
                    return (
                      <div
                        key={dim}
                        style={{
                          padding: 'var(--space-2) var(--space-3)',
                          backgroundColor: 'var(--bg-base)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600, color: DIMENSION_DETAILS[dim]?.color }}>
                            {DIMENSION_DETAILS[dim]?.label}
                          </span>
                          <span style={{ fontWeight: 700 }}>{dimVal.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={dimVal}
                          onChange={(e) =>
                            setDimensionProfile((prev) => ({
                              ...prev,
                              [dim]: parseFloat(e.target.value),
                            }))
                          }
                          style={{ width: '100%' }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                <Button variant="secondary" type="button" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? 'Saving Career...' : 'Create Career'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
