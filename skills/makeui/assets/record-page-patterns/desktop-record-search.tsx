import { useEffect, useRef } from 'react';
import { Input } from 'antd';
import type { RecordSearchProps } from './types';

/** Render beneath the existing desktop MakeDesignProvider; do not add a second theme. */
export function DesktopRecordSearch({ value, onChange, onApply, onCompositionStart, onCompositionEnd, onCompositionCancel, label, placeholder }: RecordSearchProps) {
  const composing = useRef(false);
  const cancelComposition = useRef(onCompositionCancel);
  cancelComposition.current = onCompositionCancel;
  useEffect(() => () => {
    if (!composing.current) return;
    composing.current = false;
    cancelComposition.current();
  }, []);
  return <Input.Search type="search" allowClear aria-label={label} placeholder={placeholder} value={value}
    onChange={(event) => onChange(event.target.value)}
    onCompositionStart={() => { composing.current = true; onCompositionStart(); }}
    onCompositionEnd={(event) => { composing.current = false; onCompositionEnd(event.currentTarget.value); }}
    onSearch={(query, event, info) => {
      // AntD also emits onSearch for its clear icon, before onChange. The host's
      // existing draft update handles that reset once; it is not a second apply.
      if (info?.source === 'clear' || composing.current) return;
      const nativeEvent = event?.nativeEvent;
      if (nativeEvent && (('isComposing' in nativeEvent && nativeEvent.isComposing) || ('keyCode' in nativeEvent && nativeEvent.keyCode === 229))) return;
      event?.preventDefault();
      onApply(query);
    }} />;
}
