import React, { useEffect, useState, useCallback } from 'react';
import { adminApi, ListUsersParams } from '@/services/api/admin.api';
import { UserProfile } from '@/types/models';
import { Button } from '@/components/shared/Button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'STUDENT' | 'COUNSELLOR' | 'ADMIN'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: ListUsersParams = {};
      if (roleFilter !== 'ALL') params.role = roleFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const res = await adminApi.listUsers(params);
      setUsers(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user accounts');
    } finally {
      setLoading(false);
    }
  }, [roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleStatus = async (user: UserProfile) => {
    const nextStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const actionWord = nextStatus === 'SUSPENDED' ? 'suspend' : 'reactivate';
    if (!window.confirm(`Are you sure you want to ${actionWord} account "${user.displayName || user.email}"?`)) {
      return;
    }

    try {
      setUpdatingId(user.id);
      await adminApi.updateUserStatus(user.id, nextStatus);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : `Failed to ${actionWord} user`);
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Account Administration
        </span>
        <h2>User Account Management</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Inspect user accounts, verify roles, and manage access status across students, academic counsellors, and administrators.
        </p>
      </div>

      {/* Filter Controls */}
      <div className="card" style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <label htmlFor="role-filter" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
            Filter by Role
          </label>
          <select
            id="role-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-base)',
              color: 'var(--text-main)',
              fontSize: '13px',
            }}
          >
            <option value="ALL">All Roles</option>
            <option value="STUDENT">Students</option>
            <option value="COUNSELLOR">Counsellors</option>
            <option value="ADMIN">Administrators</option>
          </select>
        </div>

        <div>
          <label htmlFor="status-filter" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
            Filter by Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-base)',
              color: 'var(--text-main)',
              fontSize: '13px',
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
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
          <Button size="sm" variant="secondary" onClick={fetchUsers}>Retry</Button>
        </div>
      )}

      {/* Main Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <LoadingSpinner />
        </div>
      ) : users.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <div style={{ fontSize: '36px', marginBottom: 'var(--space-2)' }}>👥</div>
          <h3>No Users Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: 'var(--space-2)' }}>
            No registered users match the selected filters.
          </p>
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-base)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Name / Email</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Role</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Created</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isStudent = user.role === 'STUDENT';
                const isCounsellor = user.role === 'COUNSELLOR';
                const isActive = user.status === 'ACTIVE';

                return (
                  <tr key={user.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{user.displayName}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user.email}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: isStudent
                            ? 'rgba(99, 102, 241, 0.1)'
                            : isCounsellor
                            ? 'rgba(16, 185, 129, 0.1)'
                            : 'rgba(245, 158, 11, 0.1)',
                          color: isStudent
                            ? 'var(--primary)'
                            : isCounsellor
                            ? 'var(--success)'
                            : 'var(--warning)',
                        }}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: isActive ? 'var(--success)' : 'var(--danger)',
                        }}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                      {formatDate(user.createdAt)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <Button
                        size="sm"
                        variant={isActive ? 'danger' : 'primary'}
                        disabled={updatingId === user.id}
                        onClick={() => handleToggleStatus(user)}
                      >
                        {updatingId === user.id ? 'Updating...' : isActive ? 'Suspend' : 'Reactivate'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
