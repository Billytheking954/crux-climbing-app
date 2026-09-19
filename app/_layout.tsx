import {
  DefaultTheme,
  ThemeProvider,
  type Theme,
} from '@react-navigation/native';
import {
  Stack,
  type ErrorBoundaryProps,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { AppButton } from '@/components/core/AppButton';
import {
  CruxTheme,
  DefaultCruxScheme,
  Layout,
  Spacing,
  Typography,
} from '@/constants/theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export function ErrorBoundary({
  error,
  retry,
}: ErrorBoundaryProps) {
  const theme = CruxTheme.light;

  return (
    <SafeAreaView style={[styles.errorSafeArea, { backgroundColor: theme.background }]}>
      <View style={styles.errorContent}>
        <Text style={[styles.errorTitle, { color: theme.textPrimary }]}>CRUX hit an error</Text>
        <Text style={[styles.errorText, { color: theme.textMuted }]}>
          Your saved climbing data has not been intentionally cleared. Retry this screen first.
        </Text>
        {__DEV__ ? (
          <Text selectable style={[styles.errorDetail, { color: theme.textSecondary }]}>
            {error.message}
          </Text>
        ) : null}
        <AppButton
          label="Retry"
          scheme="light"
          onPress={() => {
            void retry();
          }}
        />
      </View>
    </SafeAreaView>
  );
}

export default function RootLayout() {
  const theme = CruxTheme[DefaultCruxScheme];

  const navigationTheme = useMemo<Theme>(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        primary: theme.action,
        background: theme.background,
        card: theme.surface,
        text: theme.textPrimary,
        border: theme.border,
        notification: theme.project,
      },
    }),
    [theme],
  );

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: theme.background,
          },
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  errorSafeArea: {
    flex: 1,
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Layout.horizontalPadding,
  },
  errorTitle: {
    ...Typography.title,
  },
  errorText: {
    ...Typography.body,
  },
  errorDetail: {
    ...Typography.caption,
    maxHeight: 140,
  },
});
