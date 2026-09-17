import { useRef, useState } from 'react';
import Icon from './Icon';
import useDismissOnEscape from '../hooks/useDismissOnEscape';

/**
 * The "+" floating button on Home that replaced the chatbot FAB there (WS2
 * of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md — the chatbot moved to
 * Explore). Purely presentational: it gathers text + an optional photo and
 * hands them to `onSubmit`, which owns compression, upload, the optimistic
 * feed insert, and points reconciliation (see ForYouScreen.jsx).
 *
 * Position matches AskWellCircle.jsx's own FAB exactly, since this sits in
 * the same spot on the same screen.
 *
 * @param {{onSubmit: (input: {content: string, file: File|null,
 *          localPreviewUrl: string|null}) => void}} props
 */
export default function PostComposerFab({ onSubmit }) {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);
  useDismissOnEscape(() => setIsOpen(false), isOpen);

  const reset = () => {
    setContent('');
    setFile(null);
    setPreviewUrl(null);
  };

  const close = () => {
    setIsOpen(false);
    reset();
  };

  const handlePickPhoto = (event) => {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (!picked) return;
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
  };

  const canSubmit = content.trim().length > 0 || Boolean(file);

  const handleSubmit = () => {
    if (!canSubmit) return;
    const payload = { content: content.trim(), file, localPreviewUrl: previewUrl };
    setIsOpen(false);
    reset();
    onSubmit?.(payload);
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: 'calc(var(--nav-height) + var(--safe-bottom) + 20px)',
            right: 'calc(50% - 215px + 20px)',
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
            zIndex: 100,
          }}
          className="fab-ask"
          id="post-composer-fab"
          aria-label="New post"
        >
          <Icon name="plus" size={26} />
        </button>
      )}

      <style>{`
        @media (max-width: 430px) {
          .fab-ask { right: 20px !important; }
        }
      `}</style>

      {isOpen && (
        <>
          <div className="burger-overlay" onClick={close} style={{ zIndex: 200 }} />
          <div
            style={{
              position: 'fixed',
              left: 0, right: 0, bottom: 0,
              maxWidth: '430px',
              margin: '0 auto',
              background: 'var(--bg-card)',
              borderRadius: '20px 20px 0 0',
              zIndex: 201,
              padding: '16px 16px calc(16px + var(--safe-bottom))',
              boxShadow: 'var(--shadow-lg)',
            }}
            id="post-composer-sheet"
          >
            <div className="flex items-center justify-between mb-12">
              <strong style={{ fontSize: '1rem' }}>New post</strong>
              <button className="btn btn-icon btn-secondary" onClick={close} aria-label="Close">
                <Icon name="x" size={18} />
              </button>
            </div>

            <textarea
              className="input"
              style={{ width: '100%', minHeight: 90, resize: 'vertical' }}
              placeholder="Share an update…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              autoFocus
              id="post-composer-textarea"
            />

            {previewUrl && (
              <div style={{ position: 'relative', marginTop: 10, height: 160, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <img src={previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  className="btn btn-icon btn-secondary"
                  onClick={() => { setFile(null); setPreviewUrl(null); }}
                  style={{ position: 'absolute', top: 6, right: 6 }}
                  aria-label="Remove photo"
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            )}

            <div className="flex items-center gap-8 mt-12">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePickPhoto}
                style={{ display: 'none' }}
                id="post-composer-file-input"
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Icon name="camera" size={15} /> Photo
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginLeft: 'auto' }}
                disabled={!canSubmit}
                onClick={handleSubmit}
                id="post-composer-submit"
              >
                Post
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
