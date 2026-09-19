import {
    Pressable,
    StyleSheet,
    Text,
    View,
    type StyleProp,
    type ViewStyle,
} from 'react-native';

import {
    CruxTheme,
    DefaultCruxScheme,
    Size,
    Spacing,
    Typography,
    type CruxColorScheme,
} from '@/constants/theme';

export type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
  scheme?: CruxColorScheme;
  style?: StyleProp<ViewStyle>;
};

export function SectionHeader({
  title,
  actionLabel,
  onActionPress,
  scheme = DefaultCruxScheme,
  style,
}: SectionHeaderProps) {
  const theme = CruxTheme[scheme];

  return (
    <View
      style={[
        styles.container,
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.title,
          {
            color: theme.textPrimary,
          },
        ]}
      >
        {title}
      </Text>

      {actionLabel && onActionPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onActionPress}
          style={({ pressed }) => [
            styles.action,
            {
              opacity: pressed ? 0.65 : 1,
            },
          ]}
        >
          <Text
            numberOfLines={1}
            style={[
              styles.actionText,
              {
                color: theme.action,
              },
            ]}
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: Size.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginTop: Spacing.xl,
    marginBottom: Spacing.xs,
  },

  title: {
    ...Typography.subheading,
    flex: 1,
    minWidth: 0,
  },

  action: {
    minHeight: Size.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
    marginRight: -Spacing.xs,
  },

  actionText: {
    ...Typography.bodyStrong,
    fontSize: 14,
    lineHeight: 18,
  },
});