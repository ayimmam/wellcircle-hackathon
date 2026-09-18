/**
 * usePostComments — shared optimistic comment/reply hook (WS13 of
 * docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026_ROUND2.md).
 *
 * Extracted from PostFeed.jsx so both PostFeed and FeedPostCard call the same
 * optimistic-apply/reconcile code rather than drifting into two implementations.
 */

import { useState, useCallback } from 'react';
import { createComment } from '../api/client';

export default function usePostComments(initialComments = []) {
  const [comments, setComments] = useState(initialComments);
  const [submitting, setSubmitting] = useState(false);

  const addComment = useCallback(async (postId, content, parentCommentId = null) => {
    if (!content.trim() || submitting) return null;
    setSubmitting(true);

    // Optimistic insert
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      content,
      created_at: new Date().toISOString(),
      parent_comment_id: parentCommentId,
      user: { id: 'me', name: 'You', photo_url: null },
      replies: [],
      _pending: true,
    };

    if (parentCommentId) {
      setComments(prev =>
        prev.map(c =>
          c.id === parentCommentId
            ? { ...c, replies: [...(c.replies || []), optimistic] }
            : c,
        ),
      );
    } else {
      setComments(prev => [...prev, optimistic]);
    }

    try {
      const result = await createComment(postId, { content, parent_comment_id: parentCommentId });
      // Reconcile: replace temp with real id
      if (parentCommentId) {
        setComments(prev =>
          prev.map(c =>
            c.id === parentCommentId
              ? {
                  ...c,
                  replies: (c.replies || []).map(r =>
                    r.id === tempId ? { ...r, id: result.id, _pending: false } : r,
                  ),
                }
              : c,
          ),
        );
      } else {
        setComments(prev =>
          prev.map(c => (c.id === tempId ? { ...c, id: result.id, _pending: false } : c)),
        );
      }
      return result;
    } catch {
      // Rollback
      if (parentCommentId) {
        setComments(prev =>
          prev.map(c =>
            c.id === parentCommentId
              ? { ...c, replies: (c.replies || []).filter(r => r.id !== tempId) }
              : c,
          ),
        );
      } else {
        setComments(prev => prev.filter(c => c.id !== tempId));
      }
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [submitting]);

  return { comments, setComments, addComment, submitting };
}
