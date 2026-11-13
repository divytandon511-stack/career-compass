import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RadarChart } from '@/components/student/RadarChart';

describe('RadarChart Component', () => {
  it('renders canvas with correct accessibility attributes', () => {
    render(<RadarChart scores={{ ANALYTICAL: 0.85, CREATIVE: 0.6 }} />);

    const canvas = screen.getByRole('img', {
      name: /student 6-axis interest dimension profile radar chart/i,
    });
    expect(canvas).toBeInTheDocument();
  });

  it('renders accessible data table with all 6 dimensions and formatted percentages', () => {
    const scores = {
      ANALYTICAL: 0.854,
      CREATIVE: 0.62,
      SOCIAL: 0.45,
      PRACTICAL: 0.3,
      ORGANIZATIONAL: 0.78,
      INVESTIGATIVE: 0.9,
    };

    render(<RadarChart scores={scores} />);

    const table = screen.getByRole('table', { name: /dimension scores summary table/i });
    expect(table).toBeInTheDocument();

    expect(screen.getByText('Analytical')).toBeInTheDocument();
    expect(screen.getByText('0.85 / 1.00')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();

    expect(screen.getByText('Creative')).toBeInTheDocument();
    expect(screen.getByText('0.62 / 1.00')).toBeInTheDocument();
    expect(screen.getByText('62%')).toBeInTheDocument();

    expect(screen.getByText('Investigative')).toBeInTheDocument();
    expect(screen.getByText('0.90 / 1.00')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('handles empty or missing scores gracefully with 0 values clamped', () => {
    render(<RadarChart scores={null} />);

    expect(screen.getByText('Analytical')).toBeInTheDocument();
    const zeroScores = screen.getAllByText('0.00 / 1.00');
    expect(zeroScores.length).toBe(6);
    const zeroPercents = screen.getAllByText('0%');
    expect(zeroPercents.length).toBe(6);
  });
});
