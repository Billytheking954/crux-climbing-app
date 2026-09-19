import {
  useState,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  CruxTheme,
  Interaction,
  Radius,
  Size,
  Spacing,
  Typography,
  type CruxColorScheme,
} from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type AppButtonVariant =
  | 'primary'
  | 'secondary'
  | 'destructive'
  | 'ghost';

export type AppButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: AppButtonVariant;
  disabled?: boolean;
  loading?: boolean;

  /**
   * Explicit unavailable state for features
   * that are intentionally not actionable.
   */
  empty?: boolean;
  emptyLabel?: string;

  leftAccessory?: ReactNode;
  rightAccessory?: ReactNode;

  compact?: boolean;
  scheme?: CruxColorScheme;

  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  empty = false,
  emptyLabel = 'Unavailable',
  leftAccessory,
  rightAccessory,
  compact = false,
  scheme,
  accessibilityLabel,
  style,
  testID,
}: AppButtonProps) {
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

  const unavailable =
    disabled ||
    loading ||
    empty;

  const visibleLabel =
    empty
      ? emptyLabel
      : label;

  const backgroundColor = (() => {
    switch (variant) {
      case 'secondary':
        return theme.surfaceRaised;

      case 'destructive':
        return theme.dangerSurface;

      case 'ghost':
        return 'transparent';

      case 'primary':
      default:
        return theme.action;
    }
  })();

  const pressedBackgroundColor =
    (() => {
      switch (variant) {
        case 'secondary':
          return theme.surfacePressed;

        case 'destructive':
          return theme.dangerSurface;

        case 'ghost':
          return theme.surfacePressed;

        case 'primary':
        default:
          return theme.actionPressed;
      }
    })();

  const borderColor = (() => {
    switch (variant) {
      case 'destructive':
        return theme.danger;

      case 'secondary':
        return theme.borderStrong;

      case 'ghost':
        return 'transparent';

      case 'primary':
      default:
        return theme.action;
    }
  })();

  const textColor = (() => {
    switch (variant) {
      case 'destructive':
        return theme.danger;

      case 'secondary':
      case 'ghost':
        return theme.textPrimary;

      case 'primary':
      default:
        return theme.actionText;
    }
  })();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ??
        visibleLabel
      }
      accessibilityState={{
        disabled: unavailable,
        busy: loading,
      }}
      disabled={unavailable}
      onPress={
        unavailable
          ? undefined
          : onPress
      }
      onFocus={() =>
        setFocused(true)
      }
      onBlur={() =>
        setFocused(false)
      }
      style={({ pressed }) => [
        styles.base,
        {
          minHeight:
            compact
              ? Size.buttonCompact
              : Size.button,
          backgroundColor:
            pressed &&
            !unavailable
              ? pressedBackgroundColor
              : backgroundColor,
          borderColor:
            focused &&
            !unavailable
              ? theme.focus
              : borderColor,
          borderWidth:
            focused &&
            !unavailable
              ? Interaction.focusBorderWidth
              : 1,
          opacity:
            unavailable
              ? Interaction.disabledOpacity
              : pressed
                ? Interaction.pressedOpacity
                : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={textColor}
        />
      ) : (
        <>
          {leftAccessory ? (
            <View
              style={
                styles.accessory
              }
            >
              {leftAccessory}
            </View>
          ) : null}

          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[
              styles.label,
              {
                color:
                  empty
                    ? theme.textDisabled
                    : textColor,
              },
            ]}
          >
            {visibleLabel}
          </Text>

          {rightAccessory ? (
            <View
              style={
                styles.accessory
              }
            >
              {rightAccessory}
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles =
  StyleSheet.create({
    base: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      paddingHorizontal:
        Spacing.md,
      borderRadius:
        Radius.md,
    },

    label: {
      ...Typography.bodyStrong,
      flexShrink: 1,
      textAlign: 'center',
    },

    accessory: {
      minWidth: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
