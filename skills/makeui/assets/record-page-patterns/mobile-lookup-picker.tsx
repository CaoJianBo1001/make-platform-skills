import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { MobileBottomSheet } from '@qfei-design/make-app-mobile/primitives';
import { useMakeMobileTheme } from '@qfei-design/make-app-mobile/presentation';
import type { MobilePickerItem } from '@qfei-design/make-app-mobile/pickers';
import { MobileRecordSearch } from './mobile-record-search';
import type { RecordSearchProps } from './types';

export type MobileLookupPickerProps = {
  open: boolean;
  onClose: () => void;
  value?: MobilePickerItem;
  onChange: (value: MobilePickerItem | undefined) => void;
  items: readonly MobilePickerItem[];
  search?: RecordSearchProps;
  title: string;
  emptyContent: ReactNode;
};

/** Lookup only: ordinary single/identity selectors retain package-owned immediate confirmation. */
export function MobileLookupPicker(props: MobileLookupPickerProps) {
  // Unmount the candidate draft on close. Reopening starts from the host form value.
  return props.open ? <LookupDraft {...props} /> : null;
}

function LookupDraft({ onClose, value, onChange, items, search, title, emptyContent }: MobileLookupPickerProps) {
  const [draft, setDraft] = useState(value);
  const candidateButtons = useRef(new Map<string, HTMLButtonElement>());
  const availableItems = items.filter(item => !item.disabled);
  const tabStopKey = availableItems.find(item => item.key === draft?.key)?.key ?? availableItems[0]?.key;
  const theme = useMakeMobileTheme();

  function moveDraftFocus(event: KeyboardEvent<HTMLButtonElement>, item: MobilePickerItem) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.nativeEvent.isComposing || item.disabled) return;
    const offset = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!offset || !availableItems.length) return;
    event.preventDefault();
    const index = availableItems.findIndex(candidate => candidate.key === item.key);
    const next = availableItems[(index + offset + availableItems.length) % availableItems.length];
    setDraft(next);
    candidateButtons.current.get(next.key)?.focus();
  }

  return <MobileBottomSheet open className="makeui-mobile-lookup-sheet" showHeader={false} ariaLabel={title} onClose={onClose} initialFocus="panel">
    <div className="makeui-mobile-lookup" style={theme}>
      <header className="makeui-mobile-lookup__header"><h2>{title}</h2></header>
      {(search || draft) && <div className="makeui-mobile-lookup__controls">
        {search && <MobileRecordSearch {...search} />}
        {draft && <div className="makeui-mobile-lookup__selection">{draft.label}</div>}
      </div>}
      <div className="makeui-mobile-lookup__candidates" role="radiogroup" aria-label={title}>
        {items.length ? items.map((item) => <button className="makeui-mobile-lookup__candidate" type="button" role="radio" aria-checked={draft?.key === item.key} disabled={item.disabled} key={item.key}
          tabIndex={item.key === tabStopKey ? 0 : -1}
          ref={element => { if (element) candidateButtons.current.set(item.key, element); else candidateButtons.current.delete(item.key); }}
          onKeyDown={event => moveDraftFocus(event, item)} onClick={() => setDraft(item)}>
          {item.leading}<span>{item.label}</span>{item.secondary}
        </button>) : <div className="makeui-mobile-lookup__feedback">{emptyContent}</div>}
      </div>
      <footer className="makeui-mobile-lookup__footer" style={theme}>
        <button type="button" className="makeui-mobile-lookup__clear" disabled={!draft} onClick={() => setDraft(undefined)}>清除</button>
        <button type="button" className="makeui-mobile-lookup__confirm" onClick={() => { onChange(draft); onClose(); }}>确定</button>
      </footer>
    </div>
  </MobileBottomSheet>;
}
