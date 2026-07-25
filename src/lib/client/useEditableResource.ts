'use client';

import { useEffect, useState } from 'react';
import { he } from '@/lib/he';

/**
 * Shared fetch/edit/save state machine for the course-marketing and
 * homepage editors: both load one JSON blob, patch fields locally, and PUT
 * the whole blob back on save. `load`/`save` are handed in so each caller
 * keeps its own endpoint and response shape.
 */
export function useEditableResource<T>({
  load,
  save,
}: {
  load: () => Promise<T | null>;
  save: (value: T) => Promise<boolean>;
}) {
  const [value, setValue] = useState<T | null>(null);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load().then((v) => {
      if (v) setValue(v);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set(patch: Partial<T>) {
    setValue((v) => (v ? { ...v, ...patch } : v));
    setSaved(false);
    setError(null);
    setDirty(true);
  }

  // Accepts an explicit value so a caller (e.g. an AI builder) can save a
  // just-generated draft without waiting for a `set()` state update to flush.
  async function saveNow(toSave?: T) {
    const payload = toSave ?? value;
    if (!payload) return false;
    setBusy(true);
    setError(null);
    const ok = await save(payload);
    setBusy(false);
    if (ok) {
      setValue(payload);
      setSaved(true);
      setDirty(false);
    } else {
      setError(he.error);
    }
    return ok;
  }

  return { value, set, save: saveNow, saved, dirty, busy, error };
}
