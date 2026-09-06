import { useRef, useState } from 'react';
import { createCircleStory, uploadFile } from '../../api/client';
import { showToast } from '../Toast';
import Icon from '../Icon';

/**
 * "Add to story" — a hidden file input plus the two-step upload the rest of
 * the app already uses: bytes go to /api/uploads (Cloudinary), then the
 * returned url + public_id are attached to the circle.
 *
 * Rendered as a plain button so callers can place it wherever fits; pass
 * `variant="tile"` for the rail's own add tile.
 *
 * @param {{circleId: string, onPosted?: (story: object) => void,
 *          label?: string, className?: string}} props
 */
export default function StoryComposer({ circleId, onPosted, label = 'Add to story', className = '' }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    // Clear immediately so picking the same photo twice still fires onChange.
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    try {
      const asset = await uploadFile(file, 'stories');
      const story = await createCircleStory(circleId, {
        image_url: asset.url,
        image_public_id: asset.public_id,
      });
      showToast('Story posted — it disappears in 72 hours', 'success');
      onPosted?.(story);
    } catch (err) {
      // 429 is the per-circle active-story cap, and its detail string is
      // already written for the user.
      showToast(err.message || 'Could not post that story', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFile}
        style={{ display: 'none' }}
        data-testid="story-file-input"
      />
      <button
        type="button"
        className={`btn btn-secondary flex items-center justify-center gap-6 ${className}`.trim()}
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        id="story-composer-btn"
      >
        {busy ? <span className="btn-spinner" aria-hidden="true" /> : <Icon name="camera" size={16} />}
        {busy ? 'Uploading…' : label}
      </button>
    </>
  );
}
