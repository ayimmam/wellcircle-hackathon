/**
 * Makes a non-native clickable element (a <div> card acting as a link)
 * keyboard-accessible: Enter/Space activate it, same as onClick, and it's
 * announced as a button to assistive tech.
 */
export function clickableDivProps(handler) {
  return {
    role: 'button',
    tabIndex: 0,
    onClick: handler,
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler(e);
      }
    },
  };
}
