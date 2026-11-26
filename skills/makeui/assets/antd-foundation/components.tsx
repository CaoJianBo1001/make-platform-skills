import { cloneElement, isValidElement, useCallback, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AutoComplete, Button, Cascader, ConfigProvider, DatePicker, Drawer, Form, Input, InputNumber, Select, Tabs, Tag, TimePicker, TreeSelect } from 'antd';
import type { ButtonProps, ConfigProviderProps, TabsProps, TagProps } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'dayjs/locale/zh-cn';
import {
  ArrowLeft, Building, Building2, CalendarClock, CalendarDays, CalendarRange,
  CircleDot, Coins, FingerprintPattern, Hash, Link, ListChecks, Paperclip,
  Percent, Search, TextAlignStart, Type, UserRound, UsersRound, X,
  type LucideIcon,
} from 'lucide-react';
import type {
  MakeDesignPresentation, MakeDetailGridProps, MakeFormItemProps,
  MakeFormLayoutProps, MakeRecordSurfaceProps,
} from './types';
import { isWideField, resolveAppPresentation, resolveRecordSurface, toMakeDesignVariables } from './theme.mjs';
import { createMakeDesignTheme } from './theme-config';
import { emptyMakeDesign, MakeDesignContext, useMakeDesign } from './design-context';

const fieldIcons: Readonly<Record<string, LucideIcon>> = Object.freeze({
  'Make.Field.ID': FingerprintPattern,
  'Make.Field.Text': Type,
  'Make.Field.TextArea': TextAlignStart,
  'Make.Field.Number': Hash,
  'Make.Field.SingleSelect': CircleDot,
  'Make.Field.MultiSelect': ListChecks,
  'Make.Field.Date': CalendarDays,
  'Make.Field.DateTime': CalendarClock,
  'Make.Field.DateRange': CalendarRange,
  'Make.Field.Percent': Percent,
  'Make.Field.Currency': Coins,
  'Make.Field.URL': Link,
  'Make.Field.File': Paperclip,
  'Make.Field.SingleUser': UserRound,
  'Make.Field.MultiUser': UsersRound,
  'Make.Field.SingleDepartment': Building,
  'Make.Field.MultiDepartment': Building2,
  'Make.Field.Lookup': Search,
});

const fullWidthControls = new Set<unknown>([
  Input, Input.TextArea, Input.Password, Input.Search, InputNumber,
  Select, DatePicker, DatePicker.RangePicker, TimePicker, TimePicker.RangePicker,
  Cascader, TreeSelect, AutoComplete,
]);

// Match AntD's shallow optional-content presence, including numeric 0 and true.
const hasOptionalContent = (value: ReactNode) => value != null && value !== false && value !== '';

function fillOfficialControl(children: MakeFormItemProps['children']) {
  return isValidElement<{ style?: CSSProperties }>(children) && fullWidthControls.has(children.type)
    ? cloneElement(children, { style: { width: '100%', ...(children.type === Input.TextArea ? { minHeight: 96 } : {}), ...children.props.style } })
    : children;
}

export function MakeFieldLabel({ fieldType, children, fontRole = 'fieldLabel' }: { fieldType?: string; children: ReactNode; fontRole?: 'fieldLabel' | 'meta' }) {
  const Icon = fieldType && Object.hasOwn(fieldIcons, fieldType) ? fieldIcons[fieldType] : undefined;
  return <span className="makeui-antd-field-label" data-font-role={fontRole}>
    {Icon && <Icon size={14} strokeWidth="var(--makeui-icon-stroke, 1.75)" aria-hidden="true" />}
    <span className="makeui-antd-field-name">{children}</span>
  </span>;
}

type TypographyNode = 'root' | 'input' | 'textarea' | 'content' | 'placeholder';
type ControlTypographyStyles = Partial<Record<TypographyNode, CSSProperties>> & { popup?: { root?: CSSProperties } };

function withTracking<Info>(base: ControlTypographyStyles | ((info: Info) => ControlTypographyStyles | undefined) | undefined, tracking: string, slots: readonly TypographyNode[], popup = false, fontSize?: string) {
  return (info: Info): ControlTypographyStyles => {
    const previous = (typeof base === 'function' ? base(info) : base) ?? {};
    const next = { ...previous };
    for (const slot of slots) next[slot] = { ...previous[slot], letterSpacing: tracking, ...(fontSize ? { fontSize } : {}) };
    if (popup) next.popup = { ...previous.popup, root: { ...previous.popup?.root, letterSpacing: tracking, ...(fontSize ? { fontSize } : {}) } };
    return next;
  };
}

/** ConfigProvider also themes official Select/DatePicker/Tooltip portals through React context. */
export function MakeDesignProvider({ design, locale = zhCN, children }: { design?: MakeDesignPresentation; locale?: ConfigProviderProps['locale']; children: ReactNode }) {
  const inherited = useContext(ConfigProvider.ConfigContext);
  const variables = toMakeDesignVariables(design);
  const tracking = variables['--makeui-tracking'];
  const controlText = variables['--makeui-role-control-text-size'];
  const textSlots = ['root', 'input'] as const;
  const choiceSlots = ['root', 'input', 'content', 'placeholder'] as const;
  // Both public providers are always mounted, so toggling reduced motion does not reparent host Controllers.
  return <MakeDesignContext.Provider value={design ?? emptyMakeDesign}><ConfigProvider theme={{ token: { motion: false } }}><ConfigProvider locale={locale} theme={createMakeDesignTheme(design)}
    input={{ ...inherited.input, styles: withTracking(inherited.input?.styles, tracking, textSlots, false, controlText) }}
    textArea={{ ...inherited.textArea, styles: withTracking(inherited.textArea?.styles, tracking, ['root', 'textarea'], false, controlText) }}
    inputNumber={{ ...inherited.inputNumber, styles: withTracking(inherited.inputNumber?.styles, tracking, textSlots, false, controlText) }}
    select={{ ...inherited.select, styles: withTracking(inherited.select?.styles, tracking, choiceSlots, true, controlText) }}
    treeSelect={{ ...inherited.treeSelect, styles: withTracking(inherited.treeSelect?.styles, tracking, choiceSlots, true, controlText) }}
    datePicker={{ ...inherited.datePicker, styles: withTracking(inherited.datePicker?.styles, tracking, textSlots, true, controlText) }}
    timePicker={{ ...inherited.timePicker, styles: withTracking(inherited.timePicker?.styles, tracking, textSlots, true, controlText) }}
    cascader={{ ...inherited.cascader, styles: withTracking(inherited.cascader?.styles, tracking, choiceSlots, true, controlText) }}
    button={{ ...inherited.button, styles: withTracking(inherited.button?.styles, tracking, ['root', 'content'], false, controlText) }}>
    <div className="makeui-antd-foundation" style={toMakeDesignVariables(design)}>{children}</div>
  </ConfigProvider></ConfigProvider></MakeDesignContext.Provider>;
}

export function MakeActionButton({ intent = 'primary', color, variant, className, ...props }: ButtonProps & { intent?: 'primary' | 'default' | 'danger' }) {
  const design = useMakeDesign();
  const action = resolveAppPresentation(design).componentSuite.rules.action;
  return <Button color={color ?? (intent === 'danger' ? 'danger' : intent === 'primary' ? 'primary' : 'default')}
    variant={variant ?? (intent === 'default' || action === 'outline' ? 'outlined' : 'solid')} className={['makeui-antd-action', className].filter(Boolean).join(' ')} {...props} />;
}

export function MakeStatusTag({ variant, ...props }: TagProps) {
  const status = resolveAppPresentation(useMakeDesign()).componentSuite.rules.status;
  return <Tag variant={variant ?? (status === 'outline' ? 'outlined' : status === 'accented' ? 'solid' : 'filled')} {...props} />;
}

export function MakeTabs({ type, styles, classNames, ...props }: TabsProps) {
  const tabs = resolveAppPresentation(useMakeDesign()).componentSuite.rules.tabs;
  const filledClassNames: TabsProps['classNames'] = tabs === 'filled' && styles == null
    ? (info) => {
      const host = typeof classNames === 'function' ? classNames(info) : classNames;
      return { ...host, item: ['makeui-antd-tabs-filled-item', host?.item].filter(Boolean).join(' ') };
    }
    : classNames;
  return <Tabs type={type ?? (tabs === 'segmented' || tabs === 'filled' ? 'card' : 'line')}
    classNames={filledClassNames} styles={styles} {...props} />;
}

type SurfaceFrameProps = {
  design: MakeDesignPresentation;
  surface: ReturnType<typeof resolveRecordSurface>;
  open: boolean;
  title: ReactNode;
  actions: ReactNode;
  onClose: () => void;
  children: ReactNode;
};

function RecordPage({ design, title, actions, onClose, children }: Omit<SurfaceFrameProps, 'surface' | 'open'>) {
  return <section className="makeui-antd-page" style={toMakeDesignVariables(design)}>
    <header className="makeui-antd-page-header">
      <Button type="text" icon={<ArrowLeft size={16} strokeWidth="var(--makeui-icon-stroke, 1.75)" />} aria-label="返回" onClick={onClose} />
      {title}{actions}
    </header>
    {children}
  </section>;
}

function RecordDrawer({ design, surface, open, title, actions, onClose, children, priming = false, onPresented }: SurfaceFrameProps & { priming?: boolean; onPresented?: (open: boolean) => void }) {
  const drawerOpen = open && surface.kind === 'drawer';
  return <Drawer
    open={drawerOpen || priming}
    onClose={onClose}
    placement="right"
    size={surface.kind === 'drawer' ? surface.size : undefined}
    rootClassName="makeui-antd-foundation makeui-antd-surface"
    rootStyle={{ ...toMakeDesignVariables(design), ...(surface.kind === 'page' ? { display: 'none' } : {}) }}
    title={title}
    extra={actions}
    closable={{ placement: 'end', 'aria-label': '关闭' }}
    closeIcon={<X size={16} strokeWidth="var(--makeui-icon-stroke, 1.75)" aria-hidden="true" />}
    destroyOnHidden={false}
    afterOpenChange={onPresented}
    autoFocus={drawerOpen}
    keyboard={drawerOpen}
    focusable={{ trap: drawerOpen, focusTriggerAfterClose: surface.kind === 'drawer' }}
    mask={surface.kind === 'drawer' ? { closable: true } : false}
    {...(surface.kind === 'page' ? { motion: { motionName: '', motionAppear: false, motionEnter: false, motionLeave: false } } : {})}
    styles={{ body: { padding: 0, overflow: 'hidden' }, header: { padding: 'var(--makeui-header-padding-block) var(--makeui-header-padding-inline)' }, title: { minWidth: 0 } }}
  >{children}</Drawer>;
}

/** Move only our own host slots while keeping each business subtree and portal target stable. */
function useSurfacePortalSlot(page: boolean, className: string) {
  const [target] = useState(() => {
    const element = document.createElement('div');
    element.className = className;
    return element;
  });
  const pageElement = useRef<HTMLDivElement | null>(null);
  const drawerElement = useRef<HTMLDivElement | null>(null);
  const pageSlot = useCallback((slot: HTMLDivElement | null) => {
    pageElement.current = slot;
    if (slot && page) slot.appendChild(target);
  }, [page, target]);
  const drawerSlot = useCallback((slot: HTMLDivElement | null) => {
    drawerElement.current = slot;
    if (slot && !page) slot.appendChild(target);
  }, [page, target]);
  useLayoutEffect(() => {
    const slot = page ? pageElement.current : drawerElement.current;
    slot?.appendChild(target);
    return () => { target.remove(); };
  }, [page, target]);
  return { target, pageSlot, drawerSlot };
}

function ClientRecordSurface(props: SurfaceFrameProps) {
  const { surface, open, children } = props;
  const page = surface.kind === 'page' && open;
  const content = useSurfacePortalSlot(page, 'makeui-antd-surface-content');
  const title = useSurfacePortalSlot(page, 'makeui-antd-surface-title-content');
  const actions = useSurfacePortalSlot(page, 'makeui-antd-surface-actions-content');
  const [presented, setPresented] = useState(false);
  const onPresented = useCallback((visible: boolean) => { if (visible) setPresented(true); }, []);
  return <>
    {page && <RecordPage {...props}
      title={<div className="makeui-antd-surface-title-slot" ref={title.pageSlot} />}
      actions={props.actions != null ? <div className="makeui-antd-surface-actions-slot" ref={actions.pageSlot} /> : undefined}
    ><div className="makeui-antd-surface-slot" ref={content.pageSlot} /></RecordPage>}
    {/* AntD 6 forceRender also owns Escape while closed. Prime a page-first panel once,
        hidden and non-interactive, then use the official destroyOnHidden=false cache. */}
    <RecordDrawer {...props} priming={page && !presented} onPresented={onPresented}
      title={<div className="makeui-antd-surface-title-slot" ref={title.drawerSlot} />}
      actions={props.actions != null ? <div className="makeui-antd-surface-actions-slot" ref={actions.drawerSlot} /> : undefined}
    >
      <div className="makeui-antd-surface-slot" ref={content.drawerSlot} />
      {createPortal(<div className="makeui-antd-surface-body" style={toMakeDesignVariables(props.design)}>{children}</div>, content.target)}
      {createPortal(props.title, title.target)}
      {createPortal(props.actions, actions.target)}
    </RecordDrawer>
  </>;
}

export function MakeRecordSurface({ design, mode, open, title, status, actions, onClose, children }: MakeRecordSurfaceProps) {
  const inherited = useMakeDesign();
  const activeDesign = design ?? inherited;
  const surface = resolveRecordSurface(activeDesign, mode);
  const titleGroup = <div className="makeui-antd-surface-title">
    <MakeStatusTag color="processing">{mode === 'create' ? '新建' : mode === 'edit' ? '编辑' : '详情'}</MakeStatusTag>
    <h2 className="makeui-antd-surface-heading" title={typeof title === 'string' ? title : undefined}>{title}</h2>
    {status != null && <span className="makeui-antd-surface-status">{status}</span>}
  </div>;
  const actionGroup = hasOptionalContent(actions) ? <div className="makeui-antd-surface-actions">{actions}</div> : undefined;
  const frame = { design: activeDesign, surface, open, title: titleGroup, actions: actionGroup, onClose, children };
  // Make's Vite runtime is client rendered. Keep static server exports free of DOM/portal access.
  if (typeof document === 'undefined') return surface.kind === 'page'
    ? open && <RecordPage {...frame}><div className="makeui-antd-surface-body">{children}</div></RecordPage>
    : <RecordDrawer {...frame}>{children}</RecordDrawer>;
  return <ClientRecordSurface {...frame} />;
}

/** The official form owns values, validation, required marks and the single error slot. */
export function MakeFormLayout<Values = Record<string, unknown>>({ children, className, ...props }: MakeFormLayoutProps<Values>) {
  const presentation = resolveAppPresentation(useMakeDesign());
  return <div className="makeui-antd-form-container" data-surface={presentation.surface} data-presentation={presentation.presentationId} data-component-panels={presentation.componentSuite.rules.panels ?? 'bordered'}>
    <Form<Values> layout="vertical" colon={false} {...props} className={['makeui-antd-form-grid', className].filter(Boolean).join(' ')}>
      {children}
    </Form>
  </div>;
}

export function MakeFormItem({ fieldType, wide, label, className, style, children, ...props }: MakeFormItemProps) {
  const fullWidth = wide ?? isWideField(fieldType);
  return <Form.Item {...props}
    label={hasOptionalContent(label) ? <MakeFieldLabel fieldType={fieldType}>{label}</MakeFieldLabel> : label}
    messageVariables={{ ...(typeof label === 'string' ? { label } : {}), ...props.messageVariables }}
    className={['makeui-antd-form-item', fullWidth && 'makeui-antd-form-item-wide', className].filter(Boolean).join(' ')}
    style={{ marginBottom: 0, ...style }}
  >{fillOfficialControl(children)}</Form.Item>;
}

export function MakeDetailGrid({ items }: MakeDetailGridProps) {
  const presentation = resolveAppPresentation(useMakeDesign());
  if (!items.length) return null;
  return <div className="makeui-antd-detail-container" data-surface={presentation.surface} data-presentation={presentation.presentationId} data-component-panels={presentation.componentSuite.rules.panels ?? 'bordered'}>
    <dl className="makeui-antd-detail">
      {items.map(({ key, label, fieldType, value, wide }) => <div key={key}
        className={['makeui-antd-detail-item', (wide ?? isWideField(fieldType)) && 'makeui-antd-detail-item-wide'].filter(Boolean).join(' ')}>
        <dt><MakeFieldLabel fieldType={fieldType} fontRole="meta">{label}</MakeFieldLabel></dt>
        <dd>{value == null || value === '' ? '-' : value}</dd>
      </div>)}
    </dl>
  </div>;
}
