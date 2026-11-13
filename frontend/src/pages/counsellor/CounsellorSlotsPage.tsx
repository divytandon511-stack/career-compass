import React from 'react';
import { Button } from '@/components/shared/Button';

export const CounsellorSlotsPage: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Availability Slot Management</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Publish future calendar slots for students to reserve guidance appointments.
          </p>
        </div>
        <Button>
          + Add New Slot
        </Button>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 'var(--space-4)' }}>Upcoming Slots</h3>
        <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '14px' }}>
            No slots currently published. Create a slot to allow secondary school students to book guidance time.
          </p>
        </div>
      </div>
    </div>
  );
};
