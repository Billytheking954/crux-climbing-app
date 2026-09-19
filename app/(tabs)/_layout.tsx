import {
  Ionicons,
} from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import {
  StyleSheet,
} from 'react-native';

import {
  CruxTheme,
  DefaultCruxScheme,
  Size,
  Typography,
} from '@/constants/theme';

type TabIconName =
  | 'home-outline'
  | 'home'
  | 'stats-chart-outline'
  | 'stats-chart'
  | 'flag-outline'
  | 'flag'
  | 'trail-sign-outline'
  | 'trail-sign'
  | 'settings-outline'
  | 'settings';

function getIcon(
  inactive: TabIconName,
  active: TabIconName,
  focused: boolean,
): TabIconName {
  return focused
    ? active
    : inactive;
}

export default function TabLayout() {
  /**
   * Keep the navigation shell on the same coordinated light-first
   * scheme as the rest of the redesign. Automatic dark mode comes
   * after every screen has migrated to shared design tokens.
   */
  const theme =
    CruxTheme[
      DefaultCruxScheme
    ];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard:
          true,

        tabBarActiveTintColor:
          theme.action,
        tabBarInactiveTintColor:
          theme.textMuted,

        tabBarStyle: {
          backgroundColor:
            theme.surface,
          borderTopColor:
            theme.border,
          borderTopWidth:
            StyleSheet.hairlineWidth,
          elevation: 0,
          shadowOpacity: 0,
        },

        tabBarItemStyle: {
          minHeight:
            Size.touchTarget,
        },

        tabBarLabelStyle: {
          ...Typography.caption,
          fontSize: 11,
          lineHeight: 13,
          fontWeight: '500',
          marginTop: 1,
        },

        tabBarIconStyle: {
          marginBottom: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({
            color,
            focused,
          }) => (
            <Ionicons
              name={getIcon(
                'home-outline',
                'home',
                focused,
              )}
              size={21}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarLabel: 'Stats',
          tabBarIcon: ({
            color,
            focused,
          }) => (
            <Ionicons
              name={getIcon(
                'stats-chart-outline',
                'stats-chart',
                focused,
              )}
              size={21}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="goals"
        options={{
          title: 'Goals',
          tabBarLabel: 'Goals',
          tabBarIcon: ({
            color,
            focused,
          }) => (
            <Ionicons
              name={getIcon(
                'flag-outline',
                'flag',
                focused,
              )}
              size={21}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="projects"
        options={{
          title: 'Projects',
          tabBarLabel:
            'Projects',
          tabBarIcon: ({
            color,
            focused,
          }) => (
            <Ionicons
              name={getIcon(
                'trail-sign-outline',
                'trail-sign',
                focused,
              )}
              size={21}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel:
            'Settings',
          tabBarIcon: ({
            color,
            focused,
          }) => (
            <Ionicons
              name={getIcon(
                'settings-outline',
                'settings',
                focused,
              )}
              size={21}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
