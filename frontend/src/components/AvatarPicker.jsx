/**
 * AvatarPicker — Scora-style avatar selection UI.
 *
 * Shows the current avatar large at the top, an "Attach Photo" primary CTA,
 * then "or choose a vibe" with a 4-column grid of DiceBear fun-emoji avatars
 * seeded by wellness persona names.
 *
 * The chosen avatar is stored as `avatar_vibe` (string) on the user record.
 * DiceBear URL is built client-side from the seed — zero storage cost.
 */
import { useState } from 'react';
import { motion } from 'motion/react';

// 12 wellness persona seeds — each maps to a unique DiceBear fun-emoji face.
// The seed string is stored; the image is always generated on the fly.
export const WELLNESS_VIBES = [
  { id: 'energetic',  label: 'Energetic',  emoji: '⚡' },
  { id: 'zen',        label: 'Zen',         emoji: '🧘' },
  { id: 'fierce',     label: 'Fierce',      emoji: '🔥' },
  { id: 'playful',    label: 'Playful',     emoji: '😄' },
  { id: 'focused',    label: 'Focused',     emoji: '🎯' },
  { id: 'bold',       label: 'Bold',        emoji: '💪' },
  { id: 'serene',     label: 'Serene',      emoji: '🌿' },
  { id: 'strong',     label: 'Strong',      emoji: '🏋️' },
  { id: 'joyful',     label: 'Joyful',      emoji: '✨' },
  { id: 'determined', label: 'Determined',  emoji: '🏃' },
  { id: 'balanced',   label: 'Balanced',    emoji: '☯️' },
  { id: 'vibrant',    label: 'Vibrant',     emoji: '🌈' },
];

/**
 * Build a DiceBear fun-emoji avatar URL from a vibe seed.
 * @param {string} seed - wellness vibe id
 * @param {number} size - pixel size
 */
export function dicebearUrl(seed, size = 80) {
  return `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${encodeURIComponent(seed)}&size=${size}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

export default function AvatarPicker({
  currentVibe,
  currentPhotoUrl,
  onVibeSelect,
  onPhotoClick,
  onClose,
}) {
  const [selected, setSelected] = useState(currentVibe || null);
  const displaySeed = selected || currentVibe || 'wellcircle';

  const handleSelect = (vibe) => {
    setSelected(vibe.id);
    onVibeSelect?.(vibe.id);
  };

  return (
    <div className="avatar-picker-overlay" onClick={onClose}>
      <motion.div
        className="avatar-picker-sheet"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      >
        {/* Header */}
        <div className="avatar-picker-header">
          <span className="avatar-picker-title">Edit Profile Photo</span>
          <button className="avatar-picker-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Current avatar preview */}
        <div className="avatar-picker-preview">
          <motion.div
            className="avatar-picker-preview-img"
            key={displaySeed}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          >
            {currentPhotoUrl && !selected ? (
              <img src={currentPhotoUrl} alt="Current profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              <img
                src={dicebearUrl(displaySeed, 96)}
                alt="Avatar preview"
                style={{ width: '100%', height: '100%', borderRadius: '50%' }}
              />
            )}
          </motion.div>
        </div>

        {/* Primary CTA */}
        {onPhotoClick && (
          <button className="btn btn-primary btn-block avatar-picker-photo-btn" onClick={onPhotoClick}>
            📷 Attach Photo
          </button>
        )}

        {/* Divider */}
        <div className="avatar-picker-divider">
          <span>or choose a vibe</span>
        </div>

        {/* Vibe grid */}
        <div className="avatar-picker-grid">
          {WELLNESS_VIBES.map((vibe) => {
            const isSelected = selected === vibe.id || (!selected && currentVibe === vibe.id);
            return (
              <motion.button
                key={vibe.id}
                className={`avatar-picker-item ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelect(vibe)}
                whileTap={{ scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                title={vibe.label}
                id={`vibe-${vibe.id}`}
              >
                <img
                  src={dicebearUrl(vibe.id, 60)}
                  alt={vibe.label}
                  width={52}
                  height={52}
                  loading="lazy"
                />
                {isSelected && (
                  <motion.span
                    className="avatar-picker-check"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  >
                    ✓
                  </motion.span>
                )}
                <span className="avatar-picker-item-label">{vibe.emoji}</span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
