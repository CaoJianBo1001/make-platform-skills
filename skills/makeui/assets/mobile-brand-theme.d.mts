export interface MobileBrandTheme {
  primary?: string;
  onPrimary?: string;
  primarySoft?: string;
  link?: string;
  focusRing?: string;
  actionBackground?: string;
  actionBorder?: string;
  actionText?: string;
}

/** Accept resolved color semantics; discard all desktop visual/structural fields. */
export declare function toMobileBrandTheme(theme?: Readonly<MobileBrandTheme> | null): MobileBrandTheme;
