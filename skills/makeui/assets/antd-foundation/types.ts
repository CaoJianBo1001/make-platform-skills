import type { ReactNode } from 'react';
import type { FormItemProps, FormProps } from 'antd';

export type MakeTypographyRole = 'pageTitle' | 'recordTitle' | 'sectionTitle' | 'body' | 'fieldLabel' | 'controlText' | 'meta' | 'phoneHeader' | 'sheetTitle' | 'sheetHeading' | 'sheetBody' | 'sheetMeta';
export interface ResolvedTypography {
  contract: string;
  roles: Readonly<Record<MakeTypographyRole, number>>;
  tracking: Readonly<{ body: number; heading: number }>;
  sources: Readonly<Record<MakeTypographyRole | 'tracking.body' | 'tracking.heading', string>>;
  fallbacks: readonly string[];
}

/** UI-only subset of a MakeDesign v1 handoff. The host retains the complete plan. */
export interface MakeDesignPresentation {
  choices?: {
    ds?: string;
    layout?: string;
    reference?: string;
    theme?: 'light' | 'dark';
    navigation?: 'system' | 'single' | 'double';
    icon?: 'default' | 'thin';
    motion?: 'system' | 'reduced';
    presentation?: string;
    componentLanguage?: string;
    recipe?: string;
    illustration?: string;
    secondaryCardsEnabled?: boolean;
    secondaryCardStyle?: string;
    tuning?: { font?: string; spacing?: string; controls?: string; radius?: string; palette?: string; fine?: { shadow?: 'none' | 'soft' | 'raised'; fonts?: Partial<Record<'body' | 'heading' | 'mono', string>>; metrics?: Partial<Record<string, number>>; colors?: Partial<Record<'light' | 'dark', Partial<Record<string, string>>>> } };
    detailOpening?: 'system' | 'page' | 'drawer' | 'wide-drawer';
  };
  colors?: Record<string, string>;
  metrics?: {
    bodySize?: number;
    headingSize?: number;
    lineHeight?: number;
    padding?: number;
    rowHeight?: number;
    controlHeight?: number;
    radius?: number;
    tracking?: number;
  };
  controls?: { style?: Record<string, string> };
  typography?: Partial<Record<'body' | 'heading' | 'mono', string>> & { roles?: Partial<Record<MakeTypographyRole, number>>; tracking?: { body?: number; heading?: number }; sources?: Readonly<Record<string, string>>; contract?: string };
  illustration?: { id?: string; name?: string; path?: string; asset?: string; filter?: string; sha256?: string; bytes?: number; source?: string } | null;
  layout?: {
    recipe?: { id?: string; name?: string; note?: string; nav?: string; surface?: string; row?: number; padding?: number; title?: number; overview?: string; cards?: boolean };
    presentation?: { id?: string; name?: string; note?: string; traits?: readonly string[] };
    componentSuite?: { id?: string; name?: string; note?: string; rules?: Readonly<Record<string, string | number | undefined>> };
    structure?: {
      widths?: { drawer?: number; wideDrawer?: number; singleSidebar?: number; primaryRail?: number; secondarySidebar?: number; rail?: number; workspaceSidebar?: number };
      resolvedNavigation?: { mode?: string; singleSidebar?: number; primaryRail?: number; secondarySidebar?: number; rail?: number; workspaceSidebar?: number };
      navigation?: { id?: string; name?: string; note?: string };
      detail?: { id?: string; name?: string; note?: string };
    };
    secondaryCards?: { enabled?: boolean; style?: string; resolvedStyle?: string; scope?: string; applicability?: string };
  };
}

export type MakeNavigationMode = 'single' | 'double' | 'top' | 'rail' | 'workspace';

export interface ResolvedAppPresentation {
  navigation: { mode: MakeNavigationMode; widths: { singleSidebar: number; primaryRail: number; secondarySidebar: number; rail: number; workspaceSidebar: number } };
  surface: 'flat' | 'boxed' | 'inset';
  presentationId: string;
  componentSuite: NonNullable<NonNullable<MakeDesignPresentation['layout']>['componentSuite']> & { rules: Readonly<Record<string, string | number | undefined>> };
  secondaryCards: NonNullable<NonNullable<MakeDesignPresentation['layout']>['secondaryCards']>;
  illustration: MakeDesignPresentation['illustration'];
  applicability: { secondaryCards: 'disabled' | 'existing-host-slot-only'; illustration: 'none' | 'host-slot-only' };
  fallbacks: readonly string[];
}

export interface MakeAppShellProps {
  brand: ReactNode;
  title: ReactNode;
  headerEnd?: ReactNode;
  navigation: ReactNode;
  primaryNavigation?: ReactNode;
  children: ReactNode;
  className?: string;
  design?: MakeDesignPresentation;
  illustrationSlot?: ReactNode;
  secondaryCardsSlot?: ReactNode;
}

export type MakeRecordMode = 'create' | 'edit' | 'detail';

export interface MakeRecordSurfaceProps {
  design?: MakeDesignPresentation;
  mode: MakeRecordMode;
  open: boolean;
  title: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

export type MakeFormLayoutProps<Values = Record<string, unknown>> = Omit<FormProps<Values>, 'children'> & { children?: ReactNode };

export interface MakeFormItemProps extends FormItemProps {
  fieldType?: string;
  /** Explicit host override for a custom control. Standard spans come from fieldType. */
  wide?: boolean;
}

export interface MakeDetailItem {
  key: string;
  label: ReactNode;
  fieldType?: string;
  /** Already formatted and permission-filtered by the host. No data conversion occurs here. */
  value: ReactNode;
  wide?: boolean;
}

export interface MakeDetailGridProps {
  items: readonly MakeDetailItem[];
}
