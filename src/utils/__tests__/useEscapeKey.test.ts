import { renderHook } from '@testing-library/react';
import useEscapeKey from '../useEscapeKey';

describe('useEscapeKey', () => {
  test('calls onEscape callback when Escape key is pressed', () => {
    const onEscape = jest.fn();
    renderHook(() => useEscapeKey(onEscape));

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const stopPropagationSpy = jest.spyOn(event, 'stopPropagation');
    document.dispatchEvent(event);

    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(stopPropagationSpy).toHaveBeenCalled();
  });

  test('does not call onEscape on other keys', () => {
    const onEscape = jest.fn();
    renderHook(() => useEscapeKey(onEscape));

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    document.dispatchEvent(event);

    expect(onEscape).not.toHaveBeenCalled();
  });

  test('does not call onEscape when active is false', () => {
    const onEscape = jest.fn();
    renderHook(() => useEscapeKey(onEscape, false));

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(event);

    expect(onEscape).not.toHaveBeenCalled();
  });

  test('removes event listener on unmount', () => {
    const onEscape = jest.fn();
    const { unmount } = renderHook(() => useEscapeKey(onEscape));

    unmount();

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(event);

    expect(onEscape).not.toHaveBeenCalled();
  });
});
