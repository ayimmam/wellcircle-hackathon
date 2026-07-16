import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon';

import { getApiBase } from '../api/client';

export default function AskWellCircle() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFirstMessage, setIsFirstMessage] = useState(() => {
    const saved = localStorage.getItem('concierge_is_first');
    return saved ? JSON.parse(saved) : true;
  });
  
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('concierge_messages');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [{
      id: 0,
      text: "Hi! Welcome to Well Circle. Tell me what wellness service you need, your neighborhood in Addis Ababa, or your budget range, and I will find your perfect match!",
      sender: 'assistant'
    }];
  });

  useEffect(() => {
    localStorage.setItem('concierge_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('concierge_is_first', JSON.stringify(isFirstMessage));
  }, [isFirstMessage]);

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
      let data = await res.json();
      
      // Shim for broken external API: replace fallback with real provider
      if (data.data_source === 'fallback') {
        try {
          const provRes = await fetch(getApiBase() + '/providers');
          const provData = await provRes.json();
          if (provData.providers && provData.providers.length > 0) {
              const replyLower = (data.reply || '').toLowerCase() + ' ' + userMsg.toLowerCase();
              let matched = provData.providers.find(p => replyLower.includes(p.category.toLowerCase()));
              if (!matched) matched = provData.providers[Math.floor(Math.random() * provData.providers.length)];
              
              // Update the reply text to mention the matched provider instead of the fallback
              if (data.reply && data.provider_name) {
                data.reply = data.reply.replace(new RegExp(data.provider_name, 'gi'), matched.name);
              }
              
              data.provider_id = matched.id;
              data.provider_name = matched.name;
              data.data_source = 'live';
          }
        } catch (err) { }
      }

      // Only append the intro bubble if it has real content
      if (data.intro && data.intro.trim().length > 0) {
        setMessages(prev => [...prev, { id: Date.now() + 1, text: data.intro, sender: 'assistant' }]);
      }

      // Only append the reply bubble if it has real content - prevents
      // empty/blank message bubbles (e.g. on the is_first_message turn,
      // where the backend intentionally returns an empty reply).
      if (data.reply && data.reply.trim().length > 0) {
        setMessages(prev => [...prev, {
          id: Date.now() + 2,
          text: data.reply,
          sender: 'assistant',
          provider: data.provider_name ? { id: data.provider_id, name: data.provider_name, data_source: data.data_source } : null
        }]);
      }

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
                <div className="burger-logo" style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="message-circle" size={18} />
                </div>
                <div>
                  <div className="burger-brand-name">CIRCLER</div>
                  <div className="burger-brand-sub">POWERED BY WELL CIRCLE</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  className="burger-close"
                  style={{ width: 'auto', padding: '0 8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}
                  onClick={() => {
                    if (window.confirm("Clear chat history?")) {
                      setMessages([{
                        id: 0,
                        text: "Hi! Welcome to Well Circle. Tell me what wellness service you need, your neighborhood in Addis Ababa, or your budget range, and I will find your perfect match!",
                        sender: 'assistant'
                      }]);
                      setIsFirstMessage(true);
                      localStorage.removeItem('concierge_messages');
                      localStorage.removeItem('concierge_is_first');
                    }
                  }}
                  title="Clear Chat"
                >
                  Clear
                </button>
                <button className="burger-close" onClick={() => setIsOpen(false)} aria-label="Close chat">
                  <Icon name="x" size={18} />
                </button>
              </div>
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
              {messages
                .filter(msg => msg.text && msg.text.trim().length > 0)
                .map((msg) => (
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
                      <button
                        className="chip"
                        onClick={() => {
                          setIsOpen(false);
                          if (msg.provider.id && msg.provider.data_source === 'live') {
                            navigate(`/provider/${msg.provider.id}`);
                          } else {
                            navigate('/explore', { state: { search: msg.provider.name } });
                          }
                        }}
                        style={{ fontSize: '0.8rem', padding: '6px 12px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Icon name="map-pin" size={13} /> {msg.provider.name}
                      </button>
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
