import {
  forwardRef, useEffect, useImperativeHandle, useRef, useState,
  type ChangeEventHandler, type ComponentPropsWithoutRef,
} from 'react';
import { useMakeMobileTheme } from '@qfei-design/make-app-mobile/presentation';

type Modality = 'keyboard' | 'pointer';
type Listener = (modality: Modality) => void;
type ModalityStore = { subscribe: (listener: Listener) => () => void };
const documentStores = new WeakMap<Document, ModalityStore>();

function modalityStore(doc: Document): ModalityStore {
  const existing = documentStores.get(doc);
  if (existing) return existing;
  let modality: Modality = 'keyboard';
  const listeners = new Set<Listener>();
  const update = (next: Modality) => {
    if (modality === next) return;
    modality = next;
    listeners.forEach(listener => listener(modality));
  };
  const pointer = () => update('pointer');
  const key = (event: KeyboardEvent) => {
    // Typing, IME and browser shortcuts are not keyboard navigation.
    if (event.key === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey && !event.isComposing) update('keyboard');
  };
  const store: ModalityStore = {
    subscribe(listener) {
      if (!listeners.size) {
        doc.addEventListener('pointerdown', pointer, true);
        doc.addEventListener('keydown', key, true);
      }
      listeners.add(listener);
      listener(modality);
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          doc.removeEventListener('pointerdown', pointer, true);
          doc.removeEventListener('keydown', key, true);
          modality = 'keyboard';
        }
      };
    },
  };
  documentStores.set(doc, store);
  return store;
}

/** Presentation only: observe the owning document; never move focus or intercept form events. */
function useNativeValue<T extends HTMLElement>() {
  const node = useRef<T>(null);
  const [modality, setModality] = useState<Modality>('keyboard');
  useEffect(() => {
    const element = node.current;
    return element ? modalityStore(element.ownerDocument).subscribe(setModality) : undefined;
  }, []);
  return { node, modality };
}

export type MobileRecordValueInputProps = Omit<ComponentPropsWithoutRef<'input'>, 'defaultValue' | 'value' | 'onChange' | 'type'> & {
  type?: 'text' | 'email' | 'url' | 'tel' | 'password' | 'search';
  value: string | number;
  onChange: ChangeEventHandler<HTMLInputElement>;
};

/** Host-owned plain input. Numeric parsing, validation and IME value policy stay in the host adapter. */
const textInputTypes = new Set(['text', 'email', 'url', 'tel', 'password', 'search']);

export const MobileRecordValueInput = forwardRef<HTMLInputElement, MobileRecordValueInputProps>(
  function MobileRecordValueInput({ className, style, type = 'text', ...inputProps }, forwardedRef) {
    const { node, modality } = useNativeValue<HTMLInputElement>();
    const theme = useMakeMobileTheme();
    useImperativeHandle(forwardedRef, () => node.current!, []);
    return <input {...inputProps} type={textInputTypes.has(type) ? type : 'text'} ref={node} style={{ ...theme, ...style }}
      className={['makeui-mobile-record-value-input', className].filter(Boolean).join(' ')}
      data-makeui-native-value="input" data-input-modality={modality} />;
  },
);

export type MobileRecordValueTriggerProps = Omit<ComponentPropsWithoutRef<'button'>, 'type'>;

/** Host renders its current controlled selection as children; this button owns no selected value or picker state. */
export const MobileRecordValueTrigger = forwardRef<HTMLButtonElement, MobileRecordValueTriggerProps>(
  function MobileRecordValueTrigger({ children, className, style, ...buttonProps }, forwardedRef) {
    const { node, modality } = useNativeValue<HTMLButtonElement>();
    const theme = useMakeMobileTheme();
    useImperativeHandle(forwardedRef, () => node.current!, []);
    return <button {...buttonProps} type="button" ref={node} style={{ ...theme, ...style }}
      className={['makeui-mobile-record-value-trigger', className].filter(Boolean).join(' ')}
      data-makeui-native-value="trigger" data-input-modality={modality}>
      <span className="makeui-mobile-record-value-trigger__content">{children}</span>
    </button>;
  },
);
