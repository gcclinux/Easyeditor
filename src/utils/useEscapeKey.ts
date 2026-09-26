import { useEffect } from 'react';

/**
 * Hook to execute a callback when the Escape key is pressed.
 *
 * @param onEscape - Callback function to run on Escape press
 * @param active - Boolean condition controlling whether the listener is active (defaults to true)
 */
export function useEscapeKey(onEscape?: () => void, active: boolean = true): void {
  useEffect(() => {
    if (!active || !onEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onEscape();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onEscape, active]);
}

export default useEscapeKey;
