import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon';

export default function AskWellCircle() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "🌿 Hi! Welcome to Well Circle. Tell me what wellness service you need, your neighborhood in Addis Ababa, or your budget range, and I will find your perfect match!",
      sender: 'assistant'
    }
  ]);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { id: Date.now(), text: userMsg, sender: 'user' }]);
    setIsLoading(true);

    try {
      const res = await fetch("https://well-circle-concierge.onrender.com/ai/concierge", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, is_first_message: isFirstMessage }),
      });
      const data = await res.json();
      
      if (data.intro) {
        setMessages(prev => [...prev, { id: Date.now() + 1, text: data.intro, sender: 'assistant' }]);
      }
      
      setMessages(prev => [...prev, {
        id: Date.now() + 2,
        text: data.reply || "Let's find the best wellness option for you.",
        sender: 'assistant',
        provider: data.provider_id ? { id: data.provider_id, name: data.provider_name, data_source: data.data_source } : null
      }]);

      setIsFirstMessage(false);
    } catch (e) {
      setMessages(prev => [...prev, { id: Date.now() + 2, text: "Sorry, I'm having trouble connecting right now.", sender: 'assistant' }]);
    }
    
    setIsLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: 'calc(var(--nav-height) + var(--safe-bottom) + 20px)',
            right: 'calc(50% - 215px + 20px)', // max-width 430px adjustment
            background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
            color: 'var(--text-on-accent)',
            border: 'none',
            borderRadius: '50%',
            width: '56px',
            height: '56px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-lg), 0 0 15px var(--accent-glow)',
            cursor: 'pointer',
            zIndex: 100
          }}
          className="fab-ask"
        >
          <Icon name="message-circle" size={24} />
        </button>
      )}
      
      <style>{`
        @media (max-width: 430px) {
          .fab-ask {
            right: 20px !important;
          }
        }
      `}</style>

      {/* Chat Modal */}
      {isOpen && (
        <>
          <div className="burger-overlay" onClick={() => setIsOpen(false)} style={{ zIndex: 200 }} />
          <div style={{
            position: 'fixed',
            inset: 0,
            maxWidth: '430px',
            margin: '0 auto',
            backgroundColor: 'var(--bg-primary)',
            zIndex: 201,
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            {/* Header */}
            <div style={{
              padding: '16px',
              background: 'var(--bg-glass)',
              backdropFilter: 'blur(20px)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="burger-logo" style={{ width: '36px', height: '36px', fontSize: '1rem' }}>
                  ✨
                </div>
                <div>
                  <div className="burger-brand-name">AI CONCIERGE</div>
                  <div className="burger-brand-sub">POWERED BY WELL CIRCLE</div>
                </div>
              </div>
              <button className="burger-close" onClick={() => setIsOpen(false)} aria-label="Close chat">
                <Icon name="x" size={18} />
              </button>
            </div>

            {/* Messages Area */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              paddingBottom: '20px'
            }}>
              {messages.map((msg) => (
                <div key={msg.id} style={{
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: msg.sender === 'user' 
                      ? 'var(--radius-xl) var(--radius-xl) var(--radius-sm) var(--radius-xl)' 
                      : 'var(--radius-xl) var(--radius-xl) var(--radius-xl) var(--radius-sm)',
                    background: msg.sender === 'user' 
                      ? 'linear-gradient(135deg, var(--accent), var(--accent-dark))' 
                      : 'var(--bg-card)',
                    color: msg.sender === 'user' ? 'var(--text-on-accent)' : 'var(--text-primary)',
                    border: msg.sender === 'user' ? 'none' : '1px solid var(--border-card)',
                    boxShadow: 'var(--shadow-sm)',
                    fontSize: '0.95rem',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {msg.text}
                  </div>
                  
                  {msg.provider && (
                    <div style={{ alignSelf: 'flex-start', marginTop: '4px' }}>
                      {msg.provider.data_source === 'live' ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setIsOpen(false);
                            navigate(`/provider/${msg.provider.id}`);
                          }}
                          style={{ borderRadius: 'var(--radius-full)', display: 'inline-flex' }}
                        >
                          View {msg.provider.name} <Icon name="chevron-right" size={14} />
                        </button>
                      ) : (
                        <span className="chip" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                          📍 {msg.provider.name}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div style={{ alignSelf: 'flex-start', background: 'var(--bg-card)', border: '1px solid var(--border-card)', padding: '12px 16px', borderRadius: 'var(--radius-xl) var(--radius-xl) var(--radius-xl) var(--radius-sm)' }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <div style={{ width: '8px', height: '8px', background: 'var(--text-tertiary)', borderRadius: '50%', animation: 'typingPulse 1s infinite' }} />
                    <div style={{ width: '8px', height: '8px', background: 'var(--text-tertiary)', borderRadius: '50%', animation: 'typingPulse 1s infinite 0.2s' }} />
                    <div style={{ width: '8px', height: '8px', background: 'var(--text-tertiary)', borderRadius: '50%', animation: 'typingPulse 1s infinite 0.4s' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div style={{
              padding: '12px 16px',
              background: 'var(--bg-glass)',
              backdropFilter: 'blur(20px)',
              borderTop: '1px solid var(--border-subtle)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)'
            }}>
              <div style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'center'
              }}>
                <input
                  className="input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about wellness services..."
                  style={{ flex: 1, borderRadius: 'var(--radius-full)', padding: '12px 20px' }}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  style={{
                    width: '46px',
                    height: '46px',
                    padding: 0,
                    borderRadius: '50%',
                    flexShrink: 0
                  }}
                >
                  <Icon name="send" size={18} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      <style>{`
        @keyframes typingPulse {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </>
  );
}
