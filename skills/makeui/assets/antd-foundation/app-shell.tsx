import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MakeAppShellProps } from './types';
import { useMakeDesign } from './design-context';
import { resolveAppPresentation, toMakeDesignVariables } from './theme.mjs';

/** Attach before portal children run layout effects; ref detachment also handles real unmounts. */
function useBrandPortalSlot(top: boolean) {
  const [target] = useState(() => {
    if (typeof document === 'undefined') return null;
    const element = document.createElement('div');
    element.className = 'makeui-antd-shell-brand-content';
    return element;
  });
  const sideElement = useRef<HTMLDivElement | null>(null);
  const topElement = useRef<HTMLDivElement | null>(null);
  const sideSlot = useCallback((slot: HTMLDivElement | null) => {
    const previous = sideElement.current;
    sideElement.current = slot;
    if (slot && !top && target) slot.appendChild(target);
    else if (!slot && previous && target?.parentNode === previous) target.remove();
  }, [top, target]);
  const topSlot = useCallback((slot: HTMLDivElement | null) => {
    const previous = topElement.current;
    topElement.current = slot;
    if (slot && top && target) slot.appendChild(target);
    else if (!slot && previous && target?.parentNode === previous) target.remove();
  }, [top, target]);
  return { target, sideSlot, topSlot };
}

/** Presentation only: stable content ancestry preserves host Controllers and forms on plan changes. */
export function MakeAppShell({ brand, title, headerEnd, navigation, primaryNavigation, children, className, design, illustrationSlot, secondaryCardsSlot }: MakeAppShellProps) {
  const inherited = useMakeDesign();
  const activeDesign = design ?? inherited;
  const presentation = resolveAppPresentation(activeDesign);
  const mode = presentation.navigation.mode;
  const brandSlot = useBrandPortalSlot(mode === 'top');
  const brandLabel = <span className="makeui-antd-shell-brand-label" title={typeof brand === 'string' ? brand : undefined}>{brand}</span>;
  return <div className={['makeui-antd-shell', className].filter(Boolean).join(' ')}
    data-navigation={mode} data-surface={presentation.surface} data-presentation={presentation.presentationId}
    data-makeui-navigation={mode} data-makeui-surface={presentation.surface} data-makeui-presentation={presentation.presentationId}
    data-makeui-illustration={illustrationSlot == null ? 'not-provided' : 'provided'}
    data-makeui-secondary-cards={presentation.applicability.secondaryCards === 'disabled' ? 'disabled' : secondaryCardsSlot == null ? 'not-provided' : 'provided'}
    data-component-panels={presentation.componentSuite.rules.panels ?? 'bordered'}
    style={toMakeDesignVariables(activeDesign)}>
    <div className="makeui-antd-shell-brand makeui-antd-shell-region" hidden={mode === 'top'} ref={brandSlot.sideSlot}>{!brandSlot.target && mode !== 'top' ? brandLabel : null}</div>
    <aside className="makeui-antd-shell-primary makeui-antd-shell-region" data-makeui-slot="primary-navigation" hidden={mode !== 'double'} aria-label="应用导航">{primaryNavigation}</aside>
    <nav className="makeui-antd-shell-navigation makeui-antd-shell-region" aria-label="业务导航">{navigation}</nav>
    <header className="makeui-antd-shell-header">
      <div className="makeui-antd-shell-top-brand makeui-antd-shell-region" hidden={mode !== 'top'} ref={brandSlot.topSlot}>{!brandSlot.target && mode === 'top' ? brandLabel : null}</div>
      {/* The fixed workspace identity uses recordTitle, independently of its h1 semantics. */}
      <h1 className="makeui-antd-shell-title">{title}</h1>
      <div className="makeui-antd-shell-header-end" data-makeui-slot="header-end">{headerEnd}</div>
    </header>
    <main className="makeui-antd-shell-main">
      <div className="makeui-antd-shell-content">{children}</div>
      <div className="makeui-antd-shell-illustration makeui-antd-shell-region" hidden={illustrationSlot == null} style={{ filter: presentation.illustration?.filter }}>{illustrationSlot}</div>
      <section className="makeui-antd-shell-secondary makeui-antd-shell-region" data-secondary-style={presentation.applicability.secondaryCards === 'disabled' ? 'disabled' : presentation.secondaryCards.resolvedStyle ?? 'system'} hidden={secondaryCardsSlot == null}>{secondaryCardsSlot}</section>
    </main>
    {brandSlot.target && createPortal(brandLabel, brandSlot.target)}
  </div>;
}
