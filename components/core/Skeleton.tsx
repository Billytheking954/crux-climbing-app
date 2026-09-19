import {
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  CruxTheme,
  Radius,
  Spacing,
  type CruxColorScheme,
} from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type SkeletonProps = {
  width?: DimensionValue;
  height: number;
  radius?: keyof typeof Radius;
  scheme?: CruxColorScheme;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({
  width = '100%',
  height,
  radius = 'sm',
  scheme,
  style,
}: SkeletonProps) {
  const systemScheme =
    useColorScheme();

  const resolvedScheme: CruxColorScheme =
    scheme ??
    (systemScheme === 'dark'
      ? 'dark'
      : 'light');

  const theme =
    CruxTheme[resolvedScheme];

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.container,
        {
          width,
          height,
          borderRadius:
            Radius[radius],
          backgroundColor:
            theme.skeleton,
        },
        style,
      ]}
    />
  );
}

type SkeletonTextProps = {
  lines?: number;
  scheme?: CruxColorScheme;
};

export function SkeletonText({
  lines = 3,
  scheme,
}: SkeletonTextProps) {
  return (
    <View
      style={styles.textGroup}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({
        length: lines,
      }).map((_, index) => {
        const isLast =
          index ===
          lines - 1;

        return (
          <Skeleton
            key={index}
            scheme={scheme}
            height={12}
            width={
              isLast
                ? '64%'
                : '100%'
            }
          />
        );
      })}
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      overflow: 'hidden',
    },

    textGroup: {
      gap: Spacing.xs,
    },
  });
