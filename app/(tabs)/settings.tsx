import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/core/AppButton';
import { SectionHeader } from '@/components/core/SectionHeader';
import {
  CruxTheme,
  DefaultCruxScheme,
  Layout,
  Radius,
  Size,
  Spacing,
  Stroke,
  Typography,
} from '@/constants/theme';
import { settingsRepository } from '@/data/repositories';
import { defaultSettings } from '@/data/repositories/settings-repository';
import { showMessage } from '@/utils/dialogs';

const scheme = DefaultCruxScheme;
const theme = CruxTheme[scheme];

function InfoRow({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowDescription}>{description}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const [settings, setSettings] = useState(defaultSettings);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await settingsRepository.get();
      setSettings(next);
      setName(next.name);
    } catch {
      showMessage('Could not load settings', 'CRUX could not read your saved preferences. Your climbing data has not been changed.');
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const save = async () => {
    if (saving) return;
    try {
      setSaving(true);
      const next = await settingsRepository.save({ ...settings, name: name.trim() });
      setSettings(next);
      setName(next.name);
      showMessage('Settings saved', 'Your profile has been updated.');
    } catch {
      showMessage('Could not save', 'Something went wrong while saving your settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          <View style={styles.header}>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>Profile, storage information and developer checks</Text>
          </View>

          <SectionHeader title="Profile" scheme={scheme} />
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={theme.textMuted} style={styles.input} editable={!saving} maxLength={80} autoCapitalize="words" />
          </View>

          <SectionHeader title="Data" scheme={scheme} />
          <View style={styles.infoList}>
            <InfoRow title="Local storage" description="Sessions, boulders, projects, goals and settings are stored on this device." />
            <InfoRow title="Migration safety" description="CRUX keeps recovery snapshots and migration backups before changing saved-data formats." />
            <InfoRow title="Schema" description="This recovered final project uses storage schema v8." />
          </View>

          <SectionHeader title="Current logging" scheme={scheme} />
          <View style={styles.infoList}>
            <InfoRow title="Quick Log" description="Grade, result and attempts can be saved without inventing terrain, hold or movement data." />
            <InfoRow title="Detailed Log" description="Optional name, grade range, terrain, holds, movement and project links can be recorded when useful." />
          </View>

          <SectionHeader title="Developer" scheme={scheme} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open developer storage diagnostics"
            onPress={() => router.push('/developer-diagnostics')}
            style={({ pressed }) => [styles.devRow, pressed && styles.devRowPressed]}
          >
            <View style={styles.devCopy}>
              <Text style={styles.rowTitle}>Storage diagnostics</Text>
              <Text style={styles.rowDescription}>Run the real six-step Boulder save, edit and delete lifecycle test.</Text>
            </View>
            <Text style={styles.openText}>Open</Text>
          </Pressable>

          <SectionHeader title="About" scheme={scheme} />
          <View style={styles.aboutSection}>
            <Text style={styles.wordmark}>CRUX</Text>
            <Text style={styles.aboutText}>A bouldering logbook for sessions, projects, goals and progression.</Text>
            <Text style={styles.versionText}>CRUX v1.0.1 · schema v8</Text>
          </View>

          <View style={styles.saveArea}>
            <AppButton label="Save settings" loading={saving} disabled={saving} scheme={scheme} onPress={() => { void save(); }} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
  container: { flex: 1, backgroundColor: theme.background },
  content: { paddingHorizontal: Layout.horizontalPadding, paddingTop: Spacing.lg, paddingBottom: Spacing.xxxl },
  inner: { width: '100%', maxWidth: Layout.maxContentWidth, alignSelf: 'center' },
  header: { minHeight: 72, marginBottom: Spacing.md },
  title: { color: theme.textPrimary, ...Typography.screenTitle },
  subtitle: { color: theme.textMuted, ...Typography.body, marginTop: Spacing.xxs },
  fieldGroup: { paddingBottom: Spacing.lg, borderBottomWidth: Stroke.default, borderBottomColor: theme.border },
  fieldLabel: { color: theme.textPrimary, ...Typography.bodyStrong, marginBottom: Spacing.xs },
  input: { minHeight: Size.input, backgroundColor: theme.surface, borderWidth: Stroke.default, borderColor: theme.borderStrong, borderRadius: Radius.md, color: theme.textPrimary, paddingHorizontal: Spacing.md, ...Typography.body },
  infoList: { borderTopWidth: Stroke.default, borderTopColor: theme.border },
  infoRow: { minHeight: 72, justifyContent: 'center', borderBottomWidth: Stroke.default, borderBottomColor: theme.border, paddingVertical: Spacing.sm },
  rowTitle: { color: theme.textPrimary, ...Typography.bodyStrong },
  rowDescription: { color: theme.textMuted, ...Typography.caption, marginTop: Spacing.xxs, maxWidth: 560 },
  devRow: { minHeight: 76, borderTopWidth: Stroke.default, borderBottomWidth: Stroke.default, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  devRowPressed: { opacity: 0.65 },
  devCopy: { flex: 1 },
  openText: { color: theme.textPrimary, ...Typography.bodyStrong },
  aboutSection: { paddingVertical: Spacing.md, borderTopWidth: Stroke.default, borderBottomWidth: Stroke.default, borderColor: theme.border },
  wordmark: { color: theme.textPrimary, fontSize: 24, lineHeight: 28, fontWeight: '800', letterSpacing: 1.1 },
  aboutText: { color: theme.textMuted, ...Typography.body, marginTop: Spacing.xs, maxWidth: 460 },
  versionText: { color: theme.textMuted, ...Typography.caption, marginTop: Spacing.xs },
  saveArea: { marginTop: Spacing.xxl },
});
