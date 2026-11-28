import { useEffect, useRef } from 'react';
import type { RecordSearchProps } from './types';

export function MobileRecordSearch({ value, onChange, onApply, onCompositionStart, onCompositionEnd, onCompositionCancel, label, placeholder }: RecordSearchProps) {
  const composing = useRef(false);
  const cancelComposition = useRef(onCompositionCancel);
  cancelComposition.current = onCompositionCancel;
  useEffect(() => () => {
    if (!composing.current) return;
    composing.current = false;
    cancelComposition.current();
  }, []);
  return <input className="makeui-mobile-record-search" type="search" aria-label={label} placeholder={placeholder} autoComplete="off" value={value}
    onChange={(event) => onChange(event.target.value)}
    onCompositionStart={() => { composing.current = true; onCompositionStart(); }}
    onCompositionEnd={(event) => { composing.current = false; onCompositionEnd(event.currentTarget.value); }}
    onKeyDown={(event) => {
      if (event.key !== 'Enter' || composing.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      onApply(event.currentTarget.value);
    }} />;
}
