import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { InputField } from '@/components/shared/InputField';
import { Button } from '@/components/shared/Button';

export const GuidanceChatPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>MargDarshak AI Chat</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Session ID: {sessionId}</span>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/guidance')}>
          Back to Sessions
        </Button>
      </div>

      <div className="card" style={{ minHeight: '360px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--bg-base)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-pink)', marginBottom: '4px' }}>
            MargDarshak AI
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-main)', lineHeight: 1.5 }}>
            Namaste! I am your career guidance companion. I can help contextualize your interest dimensions with official NEP 2020 subject streams and verified career pathways. What questions do you have today?
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
          <div style={{ flex: 1 }}>
            <InputField
              label=""
              placeholder="Ask about academic streams, careers, or entrance examinations..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <Button style={{ alignSelf: 'flex-end', height: '42px' }}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};
