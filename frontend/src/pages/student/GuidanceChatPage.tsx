import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { guidanceApi, GuidanceMessage, GuidanceSession } from '@/services/api/guidance.api';
import { careersApi } from '@/services/api/careers.api';
import { Career } from '@/types/models';
import { Button } from '@/components/shared/Button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export const GuidanceChatPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<GuidanceSession | null>(null);
  const [messages, setMessages] = useState<GuidanceMessage[]>([]);
  const [careerMap, setCareerMap] = useState<Record<string, Career>>({});
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!sessionId) return;
    let isMounted = true;

    async function loadSession() {
      try {
        setLoading(true);
        setError(null);
        const res = await guidanceApi.getSession(sessionId!);
        if (isMounted && res.data) {
          setSession(res.data);
          setMessages(res.data.messages || []);

          // Fetch career details for grounding badges if careerIds exist
          if (res.data.careerIds && res.data.careerIds.length > 0) {
            try {
              const careersRes = await careersApi.listCareers({ limit: 50 });
              if (isMounted && careersRes.data) {
                const map: Record<string, Career> = {};
                careersRes.data.forEach((c) => {
                  map[c.id] = c;
                });
                setCareerMap(map);
              }
            } catch {
              // Non-fatal
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load guidance session');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadSession();
    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || !sessionId || sending) return;

    // Optimistically add user message
    const userMsg: GuidanceMessage = {
      role: 'user',
      text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setSending(true);
    setError(null);

    try {
      const res = await guidanceApi.sendMessage(sessionId, text);
      if (res.data && res.data.message) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: res.data.message.text,
            groundingCareerIds: res.data.message.groundingCareerIds,
            createdAt: res.data.message.createdAt,
          },
        ]);
      }
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string; status?: number };
      if (errObj.status === 429) {
        setError('Too many requests. Please wait a few seconds before asking another question.');
      } else {
        setError(errObj.message || 'Failed to get response from MargDarshak AI.');
      }
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', height: 'calc(100vh - 140px)' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Button variant="secondary" size="sm" onClick={() => navigate('/guidance')}>
            ← Sessions
          </Button>
          <div>
            <h2 style={{ fontSize: '18px', margin: 0 }}>MargDarshak AI Advisor</h2>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
              NEP 2020 Aligned • Grounded in your assessment results
            </span>
          </div>
        </div>

        {/* Focus careers pill tags */}
        {session?.careerIds && session.careerIds.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {session.careerIds.map((cid) => {
              const c = careerMap[cid];
              return (
                <span
                  key={cid}
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    color: 'var(--primary)',
                    fontWeight: 500,
                  }}
                >
                  🎯 {c ? c.title : cid.slice(0, 8)}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Error alert */}
      {error && (
        <div
          role="alert"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--danger)',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}

      {/* Chat Messages Container */}
      <div
        className="card"
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          padding: 'var(--space-4)',
          backgroundColor: 'var(--bg-base)',
        }}
      >
        {/* Intro greeting */}
        <div
          style={{
            alignSelf: 'flex-start',
            maxWidth: '85%',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '16px' }}>🤖</span>
            <strong style={{ fontSize: '13px', color: 'var(--accent-pink)' }}>MargDarshak AI</strong>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-main)', lineHeight: 1.6, margin: 0 }}>
            Namaste! I am your AI Career Guidance companion. My recommendations are strictly grounded in your validated psychometric assessment results and official secondary education pathways (Class 9–12). How can I assist your career exploration today?
          </p>
        </div>

        {/* Message history */}
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={index}
              style={{
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div
                style={{
                  backgroundColor: isUser ? 'var(--primary)' : 'var(--bg-surface)',
                  color: isUser ? '#ffffff' : 'var(--text-main)',
                  border: isUser ? 'none' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-3) var(--space-4)',
                  boxShadow: 'var(--shadow-sm)',
                  fontSize: '14px',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {!isUser && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px' }}>🤖</span>
                    <strong style={{ fontSize: '12px', color: 'var(--accent-pink)' }}>MargDarshak AI</strong>
                  </div>
                )}
                {msg.text}

                {/* Grounding career citation badges */}
                {!isUser && msg.groundingCareerIds && msg.groundingCareerIds.length > 0 && (
                  <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>
                      Referenced Educational Roadmaps:
                    </span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {msg.groundingCareerIds.map((cid) => {
                        const career = careerMap[cid];
                        return (
                          <Link
                            key={cid}
                            to={`/careers/${career?.slug || cid}`}
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(99, 102, 241, 0.1)',
                              color: 'var(--primary)',
                              textDecoration: 'none',
                              fontWeight: 600,
                            }}
                          >
                            📖 {career?.title || 'View Career'} →
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <span
                style={{
                  fontSize: '10px',
                  color: 'var(--text-dim)',
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  padding: '0 4px',
                }}
              >
                {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            </div>
          );
        })}

        {/* Loading state for sending */}
        {sending && (
          <div
            style={{
              alignSelf: 'flex-start',
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: '13px',
              color: 'var(--text-muted)',
            }}
          >
            <LoadingSpinner size="sm" />
            <span>MargDarshak is consulting curriculum standards...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask MargDarshak about school streams, exam pathways, or skill prerequisites..."
          maxLength={1000}
          disabled={sending}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-main)',
            fontSize: '14px',
            outline: 'none',
          }}
          aria-label="Your message to MargDarshak AI"
        />
        <Button type="submit" disabled={sending || !inputText.trim()} style={{ height: '44px', minWidth: '80px' }}>
          Send
        </Button>
      </form>
    </div>
  );
};
