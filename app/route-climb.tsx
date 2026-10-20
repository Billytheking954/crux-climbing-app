import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/core/AppButton';
import { CruxTheme, DefaultCruxScheme, Layout, Radius, Size, Spacing, Typography } from '@/constants/theme';
import {
  addRouteToSession,
  deleteRoute,
  getSessionById,
  updateRoute,
  type RouteClimb,
  type RouteDiscipline,
  type RouteResult,
} from '@/data/storage';
import { FRENCH_GRADES, validateRouteInput } from '@/domain/rope';
import { confirmAction, showMessage } from '@/utils/dialogs';
import { resolveRouteParam } from '@/utils/climbing';

const scheme = DefaultCruxScheme;
const theme = CruxTheme[scheme];

const TOP_ROPE_RESULTS: RouteResult[] = ['Clean', 'Attempt'];
const LEAD_RESULTS: RouteResult[] = ['Onsight', 'Flash', 'Redpoint', 'Attempt'];

function Option({
  value, selected, disabled, onPress,
}: { value: string; selected: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.option, selected && styles.optionSelected, disabled && styles.disabled]}
    >
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{value}</Text>
    </Pressable>
  );
}

export default function RouteClimbScreen() {
  const { sessionId, routeId } = useLocalSearchParams<{
    sessionId?: string | string[];
    routeId?: string | string[];
  }>();
  const resolvedSessionId = resolveRouteParam(sessionId);
  const resolvedRouteId = resolveRouteParam(routeId);
  const editing = Boolean(resolvedRouteId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedRoute, setSavedRoute] = useState<RouteClimb | null>(null);
  const [discipline, setDiscipline] = useState<RouteDiscipline>('top-rope');
  const [grade, setGrade] = useState('6a');
  const [result, setResult] = useState<RouteResult>('Clean');
  const [attempts, setAttempts] = useState('1');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    if (!resolvedSessionId) {
      showMessage('Missing session', 'Open a climbing session before logging a route.');
      setLoading(false);
      return;
    }
    try {
      const session = await getSessionById(resolvedSessionId);
      if (!session) throw new Error('Session not found.');
      if (resolvedRouteId) {
        const existing = session.routes.find((item) => item.id === resolvedRouteId);
        if (!existing) throw new Error('Route not found.');
        setSavedRoute(existing);
        setDiscipline(existing.discipline);
        setGrade(existing.grade);
        setResult(existing.result);
        setAttempts(String(existing.attempts));
        setName(existing.name ?? '');
        setNotes(existing.notes ?? '');
      } else if (session.finishedAt) {
        throw new Error('This session is already finished.');
      }
    } catch (error) {
      showMessage('Could not load route', error instanceof Error ? error.message : 'Try again.');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [resolvedSessionId, resolvedRouteId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const chooseDiscipline = (next: RouteDiscipline) => {
    setDiscipline(next);
    setResult(next === 'lead' ? 'Onsight' : 'Clean');
    setAttempts('1');
  };

  const chooseResult = (next: RouteResult) => {
    setResult(next);
    if (next === 'Clean' || next === 'Onsight' || next === 'Flash') setAttempts('1');
  };

  const save = async () => {
    if (!resolvedSessionId || saving || loading) return;
    const input = {
      discipline, grade, result, attempts: Number(attempts),
      name: name.trim() || undefined, notes: notes.trim() || undefined,
    };
    try {
      validateRouteInput(input);
    } catch (error) {
      showMessage('Check route details', error instanceof Error ? error.message : 'Invalid route.');
      return;
    }
    try {
      setSaving(true);
      if (resolvedRouteId) await updateRoute(resolvedSessionId, resolvedRouteId, input);
      else await addRouteToSession(resolvedSessionId, input);
      router.back();
    } catch (error) {
      showMessage('Could not save route', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!resolvedSessionId || !resolvedRouteId || saving) return;
    const confirmed = await confirmAction({
      title: 'Delete route?',
      message: 'This permanently removes the route from this session.',
      confirmText: 'Delete', cancelText: 'Cancel', destructive: true,
    });
    if (!confirmed) return;
    try {
      setSaving(true);
      await deleteRoute(resolvedSessionId, resolvedRouteId);
      router.back();
    } catch (error) {
      showMessage('Could not delete route', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const results = discipline === 'top-rope' ? TOP_ROPE_RESULTS : LEAD_RESULTS;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.inner}>
          <Text style={styles.title}>{editing ? 'Edit route' : 'Add route'}</Text>
          <Text style={styles.subtitle}>Top-rope and lead climbs use French grades. Boulders keep V grades.</Text>

          <Text style={styles.label}>CLIMBING STYLE</Text>
          <View style={styles.choices}>
            <Option value="Top-rope" selected={discipline === 'top-rope'} disabled={saving || loading} onPress={() => chooseDiscipline('top-rope')} />
            <Option value="Lead" selected={discipline === 'lead'} disabled={saving || loading} onPress={() => chooseDiscipline('lead')} />
          </View>

          <Text style={styles.label}>ROUTE NAME (OPTIONAL)</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={120} placeholder="Route name or wall colour" placeholderTextColor={theme.textMuted} editable={!saving && !loading} />

          <Text style={styles.label}>FRENCH GRADE</Text>
          <View style={styles.choices}>
            {FRENCH_GRADES.map((item) => (
              <Option key={item} value={item} selected={grade === item} disabled={saving || loading} onPress={() => setGrade(item)} />
            ))}
          </View>

          <Text style={styles.label}>RESULT</Text>
          <View style={styles.choices}>
            {results.map((item) => (
              <Option key={item} value={item} selected={result === item} disabled={saving || loading} onPress={() => chooseResult(item)} />
            ))}
          </View>
          <Text style={styles.hint}>
            {discipline === 'top-rope'
              ? 'Clean means reaching the top without weighting the rope.'
              : 'Onsight: first try without prior beta. Flash: first try with beta. Redpoint: clean lead after previous attempts.'}
          </Text>

          <Text style={styles.label}>ATTEMPTS</Text>
          <TextInput style={styles.input} value={attempts} onChangeText={setAttempts} keyboardType="number-pad" maxLength={4} editable={!saving && !loading} />
          <Text style={styles.hint}>Log the attempts made on this route. Clean, onsight and flash require one attempt.</Text>

          <Text style={styles.label}>NOTES (OPTIONAL)</Text>
          <TextInput
            style={[styles.input, styles.notes]}
            multiline value={notes} onChangeText={setNotes}
            maxLength={2000}
            placeholder="Moves, rests or beta to remember"
            placeholderTextColor={theme.textMuted}
            editable={!saving && !loading}
            textAlignVertical="top"
          />

          <View style={styles.actions}>
            <AppButton label={editing ? 'Save route' : 'Add route'} loading={saving} disabled={saving || loading} scheme={scheme} onPress={() => { void save(); }} />
            {savedRoute ? (
              <AppButton label="Delete route" variant="secondary" disabled={saving || loading} scheme={scheme} onPress={() => { void remove(); }} />
            ) : null}
            <AppButton label="Cancel" variant="secondary" disabled={saving} scheme={scheme} onPress={() => router.back()} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Layout.horizontalPadding, paddingTop: Spacing.lg, paddingBottom: Spacing.xxxl },
  inner: { width: '100%', maxWidth: Layout.maxContentWidth, alignSelf: 'center' },
  title: { ...Typography.screenTitle, color: theme.textPrimary },
  subtitle: { ...Typography.body, color: theme.textMuted, marginTop: Spacing.sm, marginBottom: Spacing.lg },
  label: { ...Typography.bodyStrong, color: theme.textPrimary, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  option: { minHeight: Size.touchTarget, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: theme.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: theme.border },
  optionSelected: { backgroundColor: theme.action, borderColor: theme.action },
  optionText: { ...Typography.bodyStrong, color: theme.textPrimary },
  optionTextSelected: { color: theme.surface },
  disabled: { opacity: 0.5 },
  input: { minHeight: Size.input, borderRadius: Radius.md, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: theme.textPrimary, ...Typography.body },
  notes: { minHeight: 92 },
  hint: { ...Typography.caption, color: theme.textMuted, marginTop: Spacing.sm },
  actions: { gap: Spacing.sm, marginTop: Spacing.xxl },
});
