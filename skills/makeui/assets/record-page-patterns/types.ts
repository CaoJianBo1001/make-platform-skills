/** Reuse the host Controller's query; neither View owns another search state. */
export type RecordSearchProps = {
  value: string;
  /** The host owns draft updates, debouncing and immediate reset when cleared. */
  onChange: (query: string) => void;
  /** Apply immediately through the same host Controller, cancelling its pending debounce. */
  onApply: (query: string) => void;
  /** Pause host requests while the controlled draft still follows the input. */
  onCompositionStart: () => void;
  /** Resume the host debounce with the actual composition result. */
  onCompositionEnd: (query: string) => void;
  /** A composing View was removed: cancel host composition without applying its draft. */
  onCompositionCancel: () => void;
  label: string;
  placeholder?: string;
};
