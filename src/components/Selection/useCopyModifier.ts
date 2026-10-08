import { useEffect, useRef, useState } from 'preact/compat';

import { c } from '../helpers';

function isDragging(win: Window) {
  return !!win.document.body.querySelector(`.${c('drag-container')}`);
}

/**
 * Tracks whether Alt (Option on macOS) is held, so a card drag can turn into a copy.
 * Alt can be pressed or released in the middle of a drag. The value is locked when the
 * mouse button is released, since the drop runs after the landing animation and the user
 * may let go of Alt during it. While dragging, the Alt key is swallowed so it can't open
 * the window menu.
 */
export function useCopyModifier(win: Window) {
  const isCopyRef = useRef(false);
  const [isCopy, setIsCopy] = useState(false);

  useEffect(() => {
    let isLocked = false;

    const set = (value: boolean) => {
      if (isCopyRef.current === value) return;
      isCopyRef.current = value;
      setIsCopy(value);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Alt') return;
      if (isDragging(win)) e.preventDefault();
      if (!isLocked) set(e.type === 'keydown');
    };
    const onPointerDown = (e: PointerEvent) => {
      isLocked = false;
      set(e.altKey);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isLocked) set(e.altKey);
    };
    const onPointerUp = (e: PointerEvent) => {
      set(isCopyRef.current || e.altKey);
      isLocked = true;
    };
    const onBlur = () => {
      if (!isLocked) set(false);
    };

    win.addEventListener('keydown', onKey, true);
    win.addEventListener('keyup', onKey, true);
    win.addEventListener('pointerdown', onPointerDown, true);
    win.addEventListener('pointermove', onPointerMove, true);
    win.addEventListener('pointerup', onPointerUp, true);
    win.addEventListener('blur', onBlur);

    return () => {
      win.removeEventListener('keydown', onKey, true);
      win.removeEventListener('keyup', onKey, true);
      win.removeEventListener('pointerdown', onPointerDown, true);
      win.removeEventListener('pointermove', onPointerMove, true);
      win.removeEventListener('pointerup', onPointerUp, true);
      win.removeEventListener('blur', onBlur);
    };
  }, [win]);

  return { isCopyRef, isCopy };
}
