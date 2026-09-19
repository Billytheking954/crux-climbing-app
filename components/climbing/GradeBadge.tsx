import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Skeleton } from '@/components/core/Skeleton';
import {
  CruxTheme,
  Fonts,
  Interaction,
  Radius,
  Size,
  Typography,
  type CruxColorScheme,
} from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type GradeSystem =
  | 'vscale'
  | 'font'
  | 'french'
  | 'yds';

export type GradeBadgeTone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

export type GradeBadgeProps = {
  grade?: string | null;
  system?: GradeSystem;

  /**
   * Semantic colour only.
   * Do not assign colour merely
   * to decorate a grade.
   */
  tone?: GradeBadgeTone;

  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;

  scheme?: CruxColorScheme;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

function getSystemName(
  system: GradeSystem,
): string {
  switch (system) {
    case 'font':
      return 'Font';

    case 'french':
      return 'French';

    case 'yds':
      return 'YDS';

    case 'vscale':
    default:
      return 'V scale';
  }
}

export function GradeBadge({
  grade,
  system = 'vscale',
  tone = 'neutral',
  loading = false,
  disabled = false,
  onPress,
  scheme,
  accessibilityLabel,
  style,
}: GradeBadgeProps) {
  const systemScheme =
    useColorScheme();

  const resolvedScheme: CruxColorScheme =
    scheme ??
    (systemScheme === 'dark'
      ? 'dark'
      : 'light');

  const theme =
    CruxTheme[resolvedScheme];

  const [focused, setFocused] =
    useState(false);

  const empty =
    !grade ||
    !grade.trim();

  const interactive =
    typeof onPress ===
    'function';

  const visibleGrade =
    empty
      ? '—'
      : grade.trim();

  const resolvedAccessibilityLabel =
    accessibilityLabel ??
    `${getSystemName(system)} grade ${visibleGrade}`;

  const backgroundColor = (() => {
    switch (tone) {
      case 'success':
        return theme.successSurface;

      case 'warning':
        return theme.warningSurface;

      case 'danger':
        return theme.dangerSurface;

      case 'info':
        return theme.infoSurface;

      case 'neutral':
      default:
        return theme.surfaceRaised;
    }
  })();

  const foregroundColor = (() => {
    switch (tone) {
      case 'success':
        return theme.success;

      case 'warning':
        return theme.warning;

      case 'danger':
        return theme.danger;

      case 'info':
        return theme.info;

      case 'neutral':
      default:
        return theme.textPrimary;
    }
  })();

  const borderColor = (() => {
    switch (tone) {
      case 'success':
        return theme.success;

      case 'warning':
        return theme.warning;

      case 'danger':
        return theme.danger;

      case 'info':
        return theme.info;

      case 'neutral':
      default:
        return theme.borderStrong;
    }
  })();

  const badge = (
    pressed: boolean,
  ) => (
    <View
      accessible={!interactive}
      accessibilityLabel={
        !interactive
          ? resolvedAccessibilityLabel
          : undefined
      }
      style={[
        styles.badge,
        {
          backgroundColor,
          borderColor:
            focused &&
            interactive &&
            !disabled
              ? theme.focus
              : borderColor,
          borderWidth:
            focused &&
            interactive &&
            !disabled
              ? Interaction.focusBorderWidth
              : 1,
          opacity:
            disabled
              ? Interaction.disabledOpacity
              : pressed
                ? Interaction.pressedOpacity
                : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <Skeleton
          scheme={
            resolvedScheme
          }
          width={30}
          height={12}
        />
      ) : (
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          accessibilityElementsHidden={
            interactive
          }
          style={[
            styles.text,
            {
              color:
                empty
                  ? theme.textDisabled
                  : foregroundColor,
            },
          ]}
        >
          {visibleGrade}
        </Text>
      )}
    </View>
  );

  if (!interactive) {
    return badge(false);
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        resolvedAccessibilityLabel
      }
      accessibilityState={{
        disabled,
        busy: loading,
      }}
      disabled={
        disabled ||
        loading
      }
      onPress={onPress}
      onFocus={() =>
        setFocused(true)
      }
      onBlur={() =>
        setFocused(false)
      }
      style={
        styles.touchTarget
      }
    >
      {({ pressed }) =>
        badge(pressed)
      }
    </Pressable>
  );
}

const styles =
  StyleSheet.create({
    touchTarget: {
      minWidth:
        Size.touchTarget,
      minHeight:
        Size.touchTarget,
      alignItems: 'center',
      justifyContent: 'center',
    },

    badge: {
      width:
        Size.gradeBadgeWidth,
      height:
        Size.gradeBadgeHeight,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
      borderRadius:
        Radius.sm,
    },

    text: {
      ...Typography.label,
      fontFamily:
        Fonts.mono,
      fontVariant: [
        'tabular-nums',
      ],
      textAlign: 'center',
    },
  });
