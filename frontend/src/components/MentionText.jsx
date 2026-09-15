import { useNavigate } from 'react-router-dom';
import { splitMentions } from '../utils/mentions';

// Renders post/comment text with @handle tokens that match a member of this
// circle/community turned into links to their profile. Unmatched "@word"
// tokens (not a member here) render as plain text.
export default function MentionText({ text, membersByHandle }) {
  const navigate = useNavigate();
  if (!membersByHandle || membersByHandle.size === 0) return text;

  return splitMentions(text, membersByHandle).map((part, i) => {
    if (typeof part === 'string') return part;
    return (
      <button
        key={i}
        type="button"
        className="mention-link"
        onClick={(e) => { e.stopPropagation(); navigate(`/users/${part.member.user_id}`); }}
      >
        {part.mention}
      </button>
    );
  });
}
