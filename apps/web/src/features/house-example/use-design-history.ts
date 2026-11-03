import { useEffect, useRef, useState } from 'react';
import { recordEdit, startEditHistory } from './design-history.js';
export function useDesignHistory<T>(value: T, restore: (value: T) => void) {
  const [history, setHistory] = useState(() => startEditHistory(value));
  const replay = useRef<string | null>(null);
  const separate = useRef(false);
  const json = JSON.stringify(value);
  useEffect(() => {
    if (replay.current === json) {
      replay.current = null;
      return;
    }
    const force = separate.current;
    separate.current = false;
    setHistory((current) => recordEdit(current, value, Date.now(), force));
  }, [json]);
  const move = (index: number) => {
    const entry = history.entries[index];
    if (!entry) return;
    replay.current = entry.json;
    setHistory({ ...history, index });
    restore(entry.value);
  };
  return {
    separateNext: () => {
      separate.current = true;
    },
    canUndo: history.index > 0,
    canRedo: history.index < history.entries.length - 1,
    undo: () => move(history.index - 1),
    redo: () => move(history.index + 1),
  };
}
