import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import {
  useCallback,
  useState,
} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/core/AppButton';
import { Skeleton } from '@/components/core/Skeleton';
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
import {
  deleteSession,
  getSessionById,
  updateSession,
  type ClimbingSession,
} from '@/data/storage';
import { resolveRouteParam } from '@/utils/climbing';
import { confirmAction, showMessage } from '@/utils/dialogs';

const scheme = DefaultCruxScheme;
const theme = CruxTheme.light;

function toDateInput(dateString: string): string {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function toTimeInput(dateString: string): string {
  const date = new Date(dateString);
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

function combineDateAndTime(dateValue: string, timeValue: string): string | null {
  const dateMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = timeValue.match(/^(\d{2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) {
    return null;
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }

  return date.toISOString();
}

export default function EditSessionScreen() {
  const { sessionId } = useLocalSearchParams<{
    sessionId?: string | string[];
  }>();
  const resolvedSessionId = resolveRouteParam(sessionId);

  const [session, setSession] = useState<ClimbingSession | null>(null);
  const [gymName, setGymName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [finishDate, setFinishDate] = useState('');
  const [finishTime, setFinishTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    if (!resolvedSessionId) {
      setSession(null);
      setLoadError('The session route is missing its session ID.');
      setLoading(false);
      return;
    }

    try {
      setLoadError(null);
      const savedSession = await getSessionById(resolvedSessionId);
      setSession(savedSession);

      if (!savedSession) {
        return;
      }

      setGymName(savedSession.gymName);
      setStartDate(toDateInput(savedSession.startedAt));
      setStartTime(toTimeInput(savedSession.startedAt));

      if (savedSession.finishedAt) {
        setFinishDate(toDateInput(savedSession.finishedAt));
        setFinishTime(toTimeInput(savedSession.finishedAt));
      } else {
        setFinishDate('');
        setFinishTime('');
      }
    } catch (error) {
      console.error('Failed to load session:', error);
      setLoadError(
        error instanceof Error
          ? error.message
          : 'CRUX could not safely read this session.',
      );
    } finally {
      setLoading(false);
    }
  }, [resolvedSessionId]);

  useFocusEffect(
    useCallback(() => {
      void loadSession();
    }, [loadSession]),
  );

  const saveChanges = async () => {
    if (saving || !resolvedSessionId || !session) {
      return;
    }

    if (!gymName.trim()) {
      showMessage('Gym name required', 'Please enter a gym name.');
      return;
    }

    const newStartedAt = combineDateAndTime(startDate, startTime);
    if (!newStartedAt) {
      showMessage('Invalid start date', 'Use YYYY-MM-DD and HH:MM.');
      return;
    }

    let newFinishedAt: string | undefined;
    if (session.finishedAt) {
      newFinishedAt = combineDateAndTime(finishDate, finishTime) ?? undefined;
      if (!newFinishedAt) {
        showMessage('Invalid finish date', 'Use YYYY-MM-DD and HH:MM.');
        return;
      }
    }

    if (
      newFinishedAt &&
      new Date(newFinishedAt).getTime() < new Date(newStartedAt).getTime()
    ) {
      showMessage('Invalid times', 'The finish time cannot be before the start time.');
      return;
    }

    try {
      setSaving(true);
      await updateSession(resolvedSessionId, {
        gymName: gymName.trim(),
        startedAt: newStartedAt,
        finishedAt: newFinishedAt,
      });
      router.back();
    } catch (error) {
      console.error('Failed to update session:', error);
      showMessage(
        'Could not save session',
        error instanceof Error
          ? error.message
          : 'Something went wrong while updating the session.',
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (saving || !resolvedSessionId || !session) {
      return;
    }

    const confirmed = await confirmAction({
      title: 'Delete entire session?',
      message: `This will permanently delete ${session.boulders.length} boulder${
        session.boulders.length === 1 ? '' : 's'
      } from ${session.gymName}.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    });

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      await deleteSession(resolvedSessionId);
      router.replace('/history');
    } catch (error) {
      console.error('Failed to delete session:', error);
      showMessage(
        'Could not delete session',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.loadingWrap}>
          <Skeleton scheme={scheme} height={44} width={220} />
          <Skeleton scheme={scheme} height={50} />
          <Skeleton scheme={scheme} height={50} />
          <Skeleton scheme={scheme} height={50} />
        </View>
      </SafeAreaView>
    );
  }

  if (!session || loadError) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.stateWrap}>
          <Text style={styles.stateTitle}>Session unavailable</Text>
          <Text style={styles.stateText}>
            {loadError ?? 'This climbing session could not be found.'}
          </Text>
          <AppButton
            label="Go back"
            variant="secondary"
            scheme={scheme}
            onPress={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.inner}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              disabled={saving}
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
                saving && styles.disabled,
              ]}
            >
              <Text style={styles.backText}>‹</Text>
            </Pressable>

            <View style={styles.headerText}>
              <Text style={styles.title}>Edit session</Text>
              <Text style={styles.subtitle}>Change the saved session details</Text>
            </View>
          </View>

          <Text style={styles.label}>GYM</Text>
          <TextInput
            value={gymName}
            onChangeText={setGymName}
            placeholder="Gym name"
            placeholderTextColor={theme.textMuted}
            style={styles.input}
            editable={!saving}
          />

          <Text style={styles.label}>START</Text>
          <View style={styles.pair}>
            <TextInput
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, styles.pairInput]}
              editable={!saving}
            />
            <TextInput
              value={startTime}
              onChangeText={setStartTime}
              placeholder="HH:MM"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, styles.pairInput]}
              editable={!saving}
            />
          </View>

          {session.finishedAt ? (
            <>
              <Text style={styles.label}>FINISH</Text>
              <View style={styles.pair}>
                <TextInput
                  value={finishDate}
                  onChangeText={setFinishDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.input, styles.pairInput]}
                  editable={!saving}
                />
                <TextInput
                  value={finishTime}
                  onChangeText={setFinishTime}
                  placeholder="HH:MM"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.input, styles.pairInput]}
                  editable={!saving}
                />
              </View>
            </>
          ) : null}

          <View style={styles.dataNote}>
            <Text style={styles.dataNoteTitle}>Climbing data stays unchanged</Text>
            <Text style={styles.dataNoteText}>
              This session contains {session.boulders.length} boulder{session.boulders.length === 1 ? '' : 's'}.
              Editing these details does not change the logged climbs.
            </Text>
          </View>

          <View style={styles.actions}>
            <AppButton
              label="Save changes"
              loading={saving}
              scheme={scheme}
              onPress={() => void saveChanges()}
            />
            <AppButton
              label="Delete session"
              variant="destructive"
              disabled={saving}
              scheme={scheme}
              onPress={() => void confirmDelete()}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
  container: { flex: 1, backgroundColor: theme.background },
  content: {
    flexGrow: 1,
    paddingHorizontal: Layout.horizontalPadding,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxxl,
  },
  inner: { width: '100%', maxWidth: Layout.maxContentWidth, alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  backButton: {
    width: Size.touchTarget,
    height: Size.touchTarget,
    borderRadius: Radius.md,
    borderWidth: Stroke.default,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { color: theme.textPrimary, fontSize: 31, lineHeight: 32, marginTop: -2 },
  headerText: { flex: 1 },
  title: { color: theme.textPrimary, ...Typography.title },
  subtitle: { color: theme.textMuted, ...Typography.caption, marginTop: 2 },
  label: {
    color: theme.textMuted,
    ...Typography.label,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  input: {
    minHeight: Size.input,
    borderRadius: Radius.md,
    borderWidth: Stroke.default,
    borderColor: theme.borderStrong,
    backgroundColor: theme.surface,
    color: theme.textPrimary,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
  },
  pair: { flexDirection: 'row', gap: Spacing.xs },
  pairInput: { flex: 1, minWidth: 0 },
  dataNote: {
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    borderTopWidth: Stroke.default,
    borderBottomWidth: Stroke.default,
    borderColor: theme.border,
  },
  dataNoteTitle: { color: theme.textPrimary, ...Typography.bodyStrong },
  dataNoteText: { color: theme.textMuted, ...Typography.caption, marginTop: Spacing.xxs },
  actions: { gap: Spacing.sm, marginTop: Spacing.xl },
  loadingWrap: {
    flex: 1,
    gap: Spacing.sm,
    paddingHorizontal: Layout.horizontalPadding,
    paddingTop: Spacing.xl,
  },
  stateWrap: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Layout.horizontalPadding,
  },
  stateTitle: { color: theme.textPrimary, ...Typography.heading },
  stateText: { color: theme.textMuted, ...Typography.body },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.44 },
});
