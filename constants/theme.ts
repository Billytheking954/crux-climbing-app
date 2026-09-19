import {
  Platform,
  type TextStyle,
} from 'react-native';

export const Palette = {
  white: '#FFFFFF',
  black: '#000000',

  chalk: '#F6F6F2',
  chalkRaised: '#FCFCFA',

  graphite: '#171A18',
  graphiteSoft: '#414843',
  graphiteMuted: '#69716B',

  limestone: '#D9DCD7',
  limestoneStrong: '#B9BEB9',
  limestoneSoft: '#ECEDE9',

  lichen: '#245B49',
  lichenPressed: '#194738',
  lichenSoft: '#E5EEE9',

  sandstone: '#A95831',
  sandstonePressed: '#844323',
  sandstoneSoft: '#F3E7DF',

  steel: '#365F78',
  steelPressed: '#294A5E',
  steelSoft: '#E5EDF2',

  danger: '#9D3731',
  dangerPressed: '#7A2A26',
  dangerSoft: '#F3E5E3',

  success: '#2D684C',
  successSoft: '#E4EFE8',

  amber: '#8A621D',
  amberSoft: '#F4ECD9',

  zinc950: '#0D0E0D',
  zinc900: '#181A19',
  zinc850: '#202321',
  zinc800: '#292C2A',
  zinc700: '#3A3E3B',
  zinc600: '#535853',
  zinc400: '#A2A8A3',
  zinc200: '#E4E7E4',
} as const;

export const CruxTheme = {
  light: {
    background: Palette.chalk,
    surface: Palette.white,
    surfaceRaised: Palette.chalkRaised,
    surfacePressed: Palette.limestoneSoft,

    border: Palette.limestone,
    borderStrong: Palette.limestoneStrong,

    textPrimary: Palette.graphite,
    textSecondary: Palette.graphiteSoft,
    textMuted: Palette.graphiteMuted,
    textDisabled: '#8A918C',

    action: Palette.lichen,
    actionPressed: Palette.lichenPressed,
    actionText: Palette.white,

    focus: Palette.steel,

    success: Palette.success,
    successSurface: Palette.successSoft,

    warning: Palette.sandstone,
    warningSurface: Palette.sandstoneSoft,

    danger: Palette.danger,
    dangerPressed: Palette.dangerPressed,
    dangerSurface: Palette.dangerSoft,

    info: Palette.steel,
    infoSurface: Palette.steelSoft,

    project: Palette.sandstone,
    projectSurface: Palette.sandstoneSoft,

    skeleton: '#E2E5E0',
    skeletonHighlight: '#EEF0EC',

    overlay: 'rgba(23, 26, 24, 0.52)',
  },

  dark: {
    background: Palette.zinc950,
    surface: Palette.zinc900,
    surfaceRaised: Palette.zinc850,
    surfacePressed: Palette.zinc800,

    border: Palette.zinc700,
    borderStrong: Palette.zinc600,

    textPrimary: '#F7F8F6',
    textSecondary: Palette.zinc200,
    textMuted: Palette.zinc400,
    textDisabled: '#727873',

    action: '#D9E6DF',
    actionPressed: '#C3D7CC',
    actionText: Palette.zinc950,

    focus: '#85ABC1',

    success: '#8BC9A6',
    successSurface: '#183629',

    warning: '#D69A77',
    warningSurface: '#43271A',

    danger: '#E19A95',
    dangerPressed: '#C97C77',
    dangerSurface: '#401E1C',

    info: '#8DB8D0',
    infoSurface: '#1D3442',

    project: '#D69A77',
    projectSurface: '#43271A',

    skeleton: Palette.zinc800,
    skeletonHighlight: Palette.zinc700,

    overlay: 'rgba(0, 0, 0, 0.72)',
  },
} as const;

export type CruxColorScheme =
  keyof typeof CruxTheme;

export const DefaultCruxScheme: CruxColorScheme =
  'light';

export const Spacing = {
  none: 0,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const Radius = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  pill: 999,
} as const;

export const Stroke = {
  default: 1,
  strong: 2,
} as const;

export const Size = {
  touchTarget: 44,
  button: 50,
  buttonCompact: 44,
  input: 50,
  iconButton: 44,
  listRow: 56,
  denseListRow: 48,
  gradeBadgeWidth: 50,
  gradeBadgeHeight: 32,
  statusBadgeHeight: 28,
  connectivityBanner: 40,
} as const;

export const Typography = {
  screenTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.4,
  },

  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.25,
  },

  heading: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },

  subheading: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
  },

  body: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
  },

  bodyStrong: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },

  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },

  metric: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    fontVariant: [
      'tabular-nums',
    ],
  },

  metricLarge: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    fontVariant: [
      'tabular-nums',
    ],
  },

  timer: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '600',
    fontVariant: [
      'tabular-nums',
    ],
    letterSpacing: -0.6,
  },
} satisfies Record<
  string,
  TextStyle
>;

const DefaultFonts = {
  sans: 'System',
  serif: 'serif',
  rounded: 'System',
  mono: 'monospace',
};

export const Fonts =
  Platform.select({
    ios: {
      sans: 'System',
      serif: 'New York',
      rounded: 'SF Pro Rounded',
      mono: 'Menlo',
    },

    android: {
      sans: 'sans-serif',
      serif: 'serif',
      rounded: 'sans-serif',
      mono: 'monospace',
    },

    web: {
      sans:
        "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",

      serif:
        "Georgia, 'Times New Roman', serif",

      rounded:
        "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif",

      mono:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    },

    default: DefaultFonts,
  }) ?? DefaultFonts;

export const Interaction = {
  pressedOpacity: 0.76,
  disabledOpacity: 0.44,
  focusBorderWidth: 2,

  // Kept for compatibility with older components.
  // New CRUX controls do not scale on press.
  pressedScale: 1,
} as const;

export const Layout = {
  horizontalPadding:
    Spacing.md,

  verticalPadding:
    Spacing.md,

  sectionSpacing:
    Spacing.xl,

  contentSpacing:
    Spacing.md,

  denseSpacing:
    Spacing.xs,

  maxContentWidth: 680,
} as const;

export const ClimbingSize = {
  gradeBadgeWidth:
    Size.gradeBadgeWidth,

  gradeBadgeHeight:
    Size.gradeBadgeHeight,

  sendStatusHeight:
    Size.statusBadgeHeight,

  logbookRowMinHeight: 64,

  topoControlSize:
    Size.touchTarget,
} as const;

export const SendSemantic = {
  flash: 'success',
  send: 'success',
  completed: 'success',
  attempt: 'neutral',
  project: 'project',
} as const;

export const Colors = {
  light: {
    text:
      CruxTheme.light.textPrimary,

    background:
      CruxTheme.light.background,

    tint:
      CruxTheme.light.action,

    icon:
      CruxTheme.light.textMuted,

    tabIconDefault:
      CruxTheme.light.textMuted,

    tabIconSelected:
      CruxTheme.light.action,
  },

  dark: {
    text:
      CruxTheme.dark.textPrimary,

    background:
      CruxTheme.dark.background,

    tint:
      CruxTheme.dark.action,

    icon:
      CruxTheme.dark.textMuted,

    tabIconDefault:
      CruxTheme.dark.textMuted,

    tabIconSelected:
      CruxTheme.dark.action,
  },
};