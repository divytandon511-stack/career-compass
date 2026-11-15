import React, { useEffect, useRef } from 'react';
import { Dimension, DIMENSIONS } from '@/types/dimensions';

export interface RadarChartProps {
  scores?: Record<string, number> | null;
  size?: number;
}

const DIMENSION_CONFIG: Record<Dimension, { label: string; color: string }> = {
  ANALYTICAL: { label: 'Analytical', color: '#6366f1' },
  CREATIVE: { label: 'Creative', color: '#ec4899' },
  SOCIAL: { label: 'Social', color: '#10b981' },
  PRACTICAL: { label: 'Practical', color: '#f59e0b' },
  ORGANIZATIONAL: { label: 'Organizational', color: '#06b6d4' },
  INVESTIGATIVE: { label: 'Investigative', color: '#8b5cf6' },
};

export const RadarChart: React.FC<RadarChartProps> = ({ scores, size = 320 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Canonical dimension ordering matching backend matching vectors
  const dimensionList = DIMENSIONS;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High-DPI screen support
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    ctx.resetTransform?.();
    ctx.scale(dpr, dpr);

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = Math.max(30, size / 2 - 45);
    const numAxes = dimensionList.length;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // 1. Draw concentric reference polygons (0.2, 0.4, 0.6, 0.8, 1.0)
    const levels = [0.2, 0.4, 0.6, 0.8, 1.0];
    levels.forEach((level) => {
      ctx.beginPath();
      for (let i = 0; i < numAxes; i++) {
        const angle = (i * 2 * Math.PI) / numAxes - Math.PI / 2;
        const x = centerX + radius * level * Math.cos(angle);
        const y = centerY + radius * level * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = level === 1.0 ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // 2. Draw 6 radial axis spokes and labels
    for (let i = 0; i < numAxes; i++) {
      const angle = (i * 2 * Math.PI) / numAxes - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      // Spoke line
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Axis Label
      const dimKey = dimensionList[i];
      const config = DIMENSION_CONFIG[dimKey];
      const labelDistance = radius + 22;
      const labelX = centerX + labelDistance * Math.cos(angle);
      const labelY = centerY + labelDistance * Math.sin(angle);

      ctx.font = '600 11px Outfit, sans-serif';
      ctx.fillStyle = config.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(config.label, labelX, labelY);
    }

    // 3. Draw Student Data Polygon
    // Backend normalized scores range strictly from 0.0 to 1.0
    ctx.beginPath();
    let hasValidData = false;

    for (let i = 0; i < numAxes; i++) {
      const dimKey = dimensionList[i];
      const rawValue = scores ? scores[dimKey] : 0;
      // Clamp between 0.0 and 1.0
      const score = typeof rawValue === 'number' && Number.isFinite(rawValue)
        ? Math.min(1.0, Math.max(0.0, rawValue))
        : 0;

      if (score > 0) hasValidData = true;

      const angle = (i * 2 * Math.PI) / numAxes - Math.PI / 2;
      const x = centerX + radius * score * Math.cos(angle);
      const y = centerY + radius * score * Math.sin(angle);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    if (hasValidData) {
      ctx.fillStyle = 'rgba(99, 102, 241, 0.35)';
      ctx.fill();
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Draw point markers
      for (let i = 0; i < numAxes; i++) {
        const dimKey = dimensionList[i];
        const rawValue = scores ? scores[dimKey] : 0;
        const score = typeof rawValue === 'number' && Number.isFinite(rawValue)
          ? Math.min(1.0, Math.max(0.0, rawValue))
          : 0;

        const angle = (i * 2 * Math.PI) / numAxes - Math.PI / 2;
        const x = centerX + radius * score * Math.cos(angle);
        const y = centerY + radius * score * Math.sin(angle);

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = DIMENSION_CONFIG[dimKey].color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    } else {
      // Empty state hint in center
      ctx.font = '500 12px Plus Jakarta Sans, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Awaiting Completed Assessment', centerX, centerY);
    }
  }, [scores, size, dimensionList]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Student 6-axis interest dimension profile radar chart"
        style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
      />

      {/* Accessible Table Equivalent for Screen Readers and Detailed Review */}
      <div style={{ width: '100%', marginTop: 'var(--space-4)' }}>
        <table
          style={{
            width: '100%',
            fontSize: '12px',
            borderCollapse: 'collapse',
            textAlign: 'left',
          }}
          aria-label="Dimension Scores Summary Table"
        >
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '6px 8px' }}>Interest Dimension</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Normalized Score</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Alignment</th>
            </tr>
          </thead>
          <tbody>
            {dimensionList.map((dim) => {
              const val = scores && typeof scores[dim] === 'number' ? scores[dim] : 0;
              const normalized = Math.min(1.0, Math.max(0.0, val));
              const pct = Math.round(normalized * 100);
              const config = DIMENSION_CONFIG[dim];

              return (
                <tr key={dim} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '6px 8px', color: config.color, fontWeight: 600 }}>
                    {config.label}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-muted)' }}>
                    {normalized.toFixed(2)} / 1.00
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>
                    {pct}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
