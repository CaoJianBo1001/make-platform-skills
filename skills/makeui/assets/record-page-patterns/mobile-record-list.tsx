import { useLayoutEffect, useRef, useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import { MobileFloatingAction } from '@qfei-design/make-app-mobile/primitives';
import { MobileBottomNavigation, type MobileBottomNavigationProps } from '@qfei-design/make-app-mobile/shell';
import { useMakeMobileTheme } from '@qfei-design/make-app-mobile/presentation';
import { MobileRecordSearch } from './mobile-record-search';

export type MobileRecordListItem = {
  key: string;
  title: ReactNode;
  content?: ReactNode;
  onOpen?: () => void;
  openLabel?: string;
  actions?: readonly { key: string; label: string; onClick: () => void; disabled?: boolean }[];
};

export type MobileRecordListProps = {
  query: string;
  onQueryChange: (query: string) => void;
  onQueryApply: (query: string) => void;
  onQueryCompositionStart: () => void;
  onQueryCompositionEnd: (query: string) => void;
  onQueryCompositionCancel: () => void;
  searchLabel: string;
  searchPlaceholder?: string;
  items: readonly MobileRecordListItem[];
  emptyContent: ReactNode;
  navigation: MobileBottomNavigationProps;
  /** Only pass an action when the existing host permission snapshot allows creation. */
  create?: { label: string; onClick: () => void };
  /** Keep the host's existing pull-to-refresh, scroll and loading Controller wiring. */
  scrollRegionProps?: Omit<ComponentPropsWithRef<'div'>, 'children' | 'className' | 'style'>;
  refreshIndicator?: ReactNode;
};

export function MobileRecordList({ query, onQueryChange, onQueryApply, onQueryCompositionStart, onQueryCompositionEnd, onQueryCompositionCancel, searchLabel, searchPlaceholder, items, emptyContent, navigation, create, scrollRegionProps, refreshIndicator }: MobileRecordListProps) {
  const theme = useMakeMobileTheme();
  const navigationRoot = useRef<HTMLDivElement>(null);
  const [navigationHeight, setNavigationHeight] = useState<number>();

  useLayoutEffect(() => {
    const element = navigationRoot.current;
    if (!element) return;
    // The package navigation stays in normal flow. Measure our wrapper, including
    // its safe-area padding and border; no package DOM/class/ref access is needed.
    const measure = () => setNavigationHeight(element.getBoundingClientRect().height);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  return (
    <section className="makeui-mobile-record-list" style={theme}>
      <div className="makeui-mobile-record-list__toolbar">
        <MobileRecordSearch value={query} onChange={onQueryChange} onApply={onQueryApply} onCompositionStart={onQueryCompositionStart} onCompositionEnd={onQueryCompositionEnd} onCompositionCancel={onQueryCompositionCancel} label={searchLabel} placeholder={searchPlaceholder} />
      </div>
      <div {...scrollRegionProps} className="makeui-mobile-record-list__scroll">
        {refreshIndicator}
        {items.length ? items.map((item) => (
          <article className="makeui-mobile-record-card" key={item.key} onClick={(event) => {
            if (event.defaultPrevented) return;
            const target = event.target;
            // Keep URL, edit and other embedded controls on their own host path.
            // Custom controls declare a boundary; arbitrary interaction cannot be inferred.
            if (target instanceof Element && target.closest('a,area,button,input,select,textarea,label,summary,audio[controls],video[controls],iframe,object,embed,[role="button"],[role="link"],[role="checkbox"],[role="radio"],[role="switch"],[role="textbox"],[role="combobox"],[role="slider"],[role="spinbutton"],[role="tab"],[role="menuitem"],[contenteditable]:not([contenteditable="false"]),[data-makeui-card-interactive]')) return;
            item.onOpen?.();
          }}>
            <div className="makeui-mobile-record-card__heading">
              <div className="makeui-mobile-record-card__title">{item.title}</div>
              {item.onOpen && <button className="makeui-mobile-record-card__action" type="button" aria-label={item.openLabel ?? '查看详情'} onClick={item.onOpen}>查看</button>}
              {!!item.actions?.length && <div className="makeui-mobile-record-card__actions">
                {item.actions.map((action) => <button className="makeui-mobile-record-card__action" key={action.key} type="button" disabled={action.disabled} onClick={action.onClick}>{action.label}</button>)}
              </div>}
            </div>
            {item.content}
          </article>
        )) : emptyContent}
      </div>
      <div className="makeui-mobile-record-list__navigation" ref={navigationRoot}>
        <MobileBottomNavigation {...navigation} />
      </div>
      {create && navigationHeight !== undefined && <MobileFloatingAction label={create.label} onClick={create.onClick} style={{ bottom: navigationHeight + 8 }} />}
    </section>
  );
}
