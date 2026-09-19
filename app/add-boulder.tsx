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
  addBoulderToSession,
  getProjects,
  getSessionById,
  type BoulderResult,
  type ClimbingProject,
} from '@/data/storage';
import {
  adjustAttemptsForResult,
  BOULDER_RESULTS,
  formatVGrade,
  HOLD_TYPES,
  isValidGradeRange,
  MOVEMENT_TYPES,
  resolveRouteParam,
  resultSupportsProjectLink,
  TERRAINS,
  validateAttempts,
  V_GRADES,
  type GradeMode,
  type Terrain,
  type VGrade,
} from '@/utils/climbing';
import { showMessage } from '@/utils/dialogs';

const scheme = DefaultCruxScheme;
const theme = CruxTheme.light;

type ChoiceButtonProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
};

function ChoiceButton({
  label,
  selected,
  onPress,
  disabled = false,
}: ChoiceButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.choiceText,
          selected && styles.choiceTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export default function AddBoulderScreen() {
  const { sessionId } = useLocalSearchParams<{
    sessionId?: string | string[];
  }>();

  const resolvedSessionId = resolveRouteParam(sessionId);

  const [boulderName, setBoulderName] = useState('');
  const [gradeMode, setGradeMode] = useState<GradeMode>('single');
  const [grade, setGrade] = useState<VGrade>('V4');
  const [gradeStart, setGradeStart] = useState<VGrade>('V4');
  const [gradeEnd, setGradeEnd] = useState<VGrade>('V5');
  const [result, setResult] = useState<BoulderResult>('Flash');
  const [attempts, setAttempts] = useState('1');
  const [terrain, setTerrain] = useState<Terrain>('Vertical');
  const [selectedHoldTypes, setSelectedHoldTypes] = useState<string[]>(['Crimp']);
  const [selectedMovementTypes, setSelectedMovementTypes] = useState<string[]>([
    'Technical',
  ]);
  const [projects, setProjects] = useState<ClimbingProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      setLoadingProjects(true);
      const savedProjects = await getProjects();
      const activeProjects = savedProjects.filter(
        (project) => project.status === 'active',
      );
      setProjects(activeProjects);
      setSelectedProjectId((current) =>
        current && activeProjects.some((project) => project.id === current)
          ? current
          : undefined,
      );
    } catch (error) {
      console.error('Failed to load projects:', error);
      showMessage(
        'Could not load projects',
        'Your project list could not be read. Your saved data has not been changed.',
      );
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProjects();
    }, [loadProjects]),
  );

  const selectedGrade =
    gradeMode === 'single' ? grade : formatVGrade(gradeStart, gradeEnd);

  const canLinkProject = resultSupportsProjectLink(result);

  const selectResult = (nextResult: BoulderResult) => {
    setResult(nextResult);
    setAttempts((current) => adjustAttemptsForResult(nextResult, current));
    if (!resultSupportsProjectLink(nextResult)) {
      setSelectedProjectId(undefined);
    }
  };

  const toggleHoldType = (value: string) => {
    setSelectedHoldTypes((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };

  const toggleMovementType = (value: string) => {
    setSelectedMovementTypes((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };

  const saveBoulder = async () => {
    if (saving) {
      return;
    }

    if (!resolvedSessionId) {
      showMessage(
        'No active session',
        'This boulder could not be linked to a climbing session.',
      );
      return;
    }

    const attemptValidation = validateAttempts(result, attempts);
    if (!attemptValidation.ok) {
      showMessage('Invalid attempts', attemptValidation.error);
      return;
    }

    if (
      gradeMode === 'range' &&
      !isValidGradeRange(gradeStart, gradeEnd)
    ) {
      showMessage(
        'Invalid grade range',
        'The first grade cannot be harder than the second grade.',
      );
      return;
    }

    if (selectedHoldTypes.length === 0) {
      showMessage('Select a hold type', 'Choose at least one hold type.');
      return;
    }

    if (selectedMovementTypes.length === 0) {
      showMessage('Select a movement', 'Choose at least one movement type.');
      return;
    }

    try {
      setSaving(true);

      const session = await getSessionById(resolvedSessionId);
      if (!session) {
        showMessage('Session not found', 'This climbing session no longer exists.');
        return;
      }

      if (session.finishedAt) {
        showMessage(
          'Session already finished',
          'You cannot add a new boulder to a finished session.',
        );
        return;
      }

      if (canLinkProject && selectedProjectId) {
        const latestProjects = await getProjects();
        const linkedProject = latestProjects.find(
          (project) => project.id === selectedProjectId,
        );

        if (!linkedProject || linkedProject.status !== 'active') {
          setSelectedProjectId(undefined);
          showMessage(
            'Project no longer active',
            'Choose an active project or save without a project link.',
          );
          return;
        }
      }

      await addBoulderToSession(resolvedSessionId, {
        name: boulderName.trim() || undefined,
        grade: selectedGrade,
        result,
        attempts: attemptValidation.value,
        terrain,
        holdType: selectedHoldTypes,
        movementType: selectedMovementTypes,
        projectId: canLinkProject ? selectedProjectId : undefined,
      });

      router.back();
    } catch (error) {
      console.error('Failed to save boulder:', error);
      showMessage(
        'Could not save boulder',
        error instanceof Error
          ? error.message
          : 'Something went wrong while saving this climb.',
      );
    } finally {
      setSaving(false);
    }
  };

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
              <Text style={styles.title}>Add boulder</Text>
              <Text style={styles.subtitle}>Log the climb while the session is active</Text>
            </View>
          </View>

          <SectionLabel>NAME</SectionLabel>
          <TextInput
            value={boulderName}
            onChangeText={setBoulderName}
            placeholder="Optional name or wall colour"
            placeholderTextColor={theme.textMuted}
            style={styles.input}
            editable={!saving}
            autoCapitalize="words"
            maxLength={60}
          />

          <SectionLabel>GRADE</SectionLabel>
          <View style={styles.segmentRow}>
            <ChoiceButton
              label="Single"
              selected={gradeMode === 'single'}
              onPress={() => setGradeMode('single')}
              disabled={saving}
            />
            <ChoiceButton
              label="Range"
              selected={gradeMode === 'range'}
              onPress={() => setGradeMode('range')}
              disabled={saving}
            />
          </View>

          {gradeMode === 'single' ? (
            <View style={styles.wrap}>
              {V_GRADES.map((item) => (
                <ChoiceButton
                  key={item}
                  label={item}
                  selected={grade === item}
                  onPress={() => setGrade(item)}
                  disabled={saving}
                />
              ))}
            </View>
          ) : (
            <>
              <Text style={styles.helper}>From</Text>
              <View style={styles.wrap}>
                {V_GRADES.map((item) => (
                  <ChoiceButton
                    key={`start-${item}`}
                    label={item}
                    selected={gradeStart === item}
                    onPress={() => setGradeStart(item)}
                    disabled={saving}
                  />
                ))}
              </View>
              <Text style={styles.helper}>To</Text>
              <View style={styles.wrap}>
                {V_GRADES.map((item) => (
                  <ChoiceButton
                    key={`end-${item}`}
                    label={item}
                    selected={gradeEnd === item}
                    onPress={() => setGradeEnd(item)}
                    disabled={saving}
                  />
                ))}
              </View>
            </>
          )}

          <SectionLabel>RESULT</SectionLabel>
          <View style={styles.resultList}>
            {BOULDER_RESULTS.map((item) => (
              <Pressable
                key={item.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: result === item.value }}
                disabled={saving}
                onPress={() => selectResult(item.value)}
                style={({ pressed }) => [
                  styles.resultRow,
                  result === item.value && styles.resultRowSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.resultTextWrap}>
                  <Text style={styles.resultTitle}>{item.label}</Text>
                  <Text style={styles.resultDescription}>{item.description}</Text>
                </View>
                <View
                  style={[
                    styles.radio,
                    result === item.value && styles.radioSelected,
                  ]}
                />
              </Pressable>
            ))}
          </View>

          <SectionLabel>ATTEMPTS</SectionLabel>
          <TextInput
            value={attempts}
            onChangeText={setAttempts}
            keyboardType="number-pad"
            placeholder="1"
            placeholderTextColor={theme.textMuted}
            style={styles.input}
            editable={!saving && result !== 'Flash'}
            maxLength={3}
          />

          <SectionLabel>TERRAIN</SectionLabel>
          <View style={styles.wrap}>
            {TERRAINS.map((item) => (
              <ChoiceButton
                key={item}
                label={item}
                selected={terrain === item}
                onPress={() => setTerrain(item)}
                disabled={saving}
              />
            ))}
          </View>

          <SectionLabel>HOLD TYPES</SectionLabel>
          <View style={styles.wrap}>
            {HOLD_TYPES.map((item) => (
              <ChoiceButton
                key={item}
                label={item}
                selected={selectedHoldTypes.includes(item)}
                onPress={() => toggleHoldType(item)}
                disabled={saving}
              />
            ))}
          </View>

          <SectionLabel>MOVEMENT TYPES</SectionLabel>
          <View style={styles.wrap}>
            {MOVEMENT_TYPES.map((item) => (
              <ChoiceButton
                key={item}
                label={item}
                selected={selectedMovementTypes.includes(item)}
                onPress={() => toggleMovementType(item)}
                disabled={saving}
              />
            ))}
          </View>

          {canLinkProject ? (
            <>
              <SectionLabel>PROJECT</SectionLabel>
              {loadingProjects ? (
                <Text style={styles.helper}>Loading projects...</Text>
              ) : projects.length === 0 ? (
                <View style={styles.infoBlock}>
                  <Text style={styles.infoTitle}>No active projects</Text>
                  <Text style={styles.infoText}>
                    The boulder can still be saved without a project link.
                  </Text>
                </View>
              ) : (
                <View style={styles.resultList}>
                  {projects.map((project) => (
                    <Pressable
                      key={project.id}
                      accessibilityRole="radio"
                      accessibilityState={{
                        selected: selectedProjectId === project.id,
                      }}
                      disabled={saving}
                      onPress={() =>
                        setSelectedProjectId((current) =>
                          current === project.id ? undefined : project.id,
                        )
                      }
                      style={({ pressed }) => [
                        styles.projectRow,
                        selectedProjectId === project.id && styles.resultRowSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.resultTextWrap}>
                        <Text style={styles.resultTitle}>{project.name}</Text>
                        <Text style={styles.resultDescription}>{project.grade}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          ) : null}

          <View style={styles.actions}>
            <AppButton
              label="Save boulder"
              loading={saving}
              scheme={scheme}
              onPress={() => void saveBoulder()}
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
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: Stroke.default,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  backText: { color: theme.textPrimary, fontSize: 31, lineHeight: 32, marginTop: -2 },
  headerText: { flex: 1 },
  title: { color: theme.textPrimary, ...Typography.title },
  subtitle: { color: theme.textMuted, ...Typography.caption, marginTop: 2 },
  sectionLabel: {
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
  segmentRow: { flexDirection: 'row', gap: Spacing.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  choice: {
    minHeight: Size.touchTarget,
    minWidth: Size.touchTarget,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: Stroke.default,
    borderColor: theme.borderStrong,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceSelected: { backgroundColor: theme.action, borderColor: theme.action },
  choiceText: { color: theme.textSecondary, ...Typography.bodyStrong, fontSize: 14 },
  choiceTextSelected: { color: theme.actionText },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.44 },
  helper: { color: theme.textMuted, ...Typography.caption, marginVertical: Spacing.xs },
  resultList: { borderTopWidth: Stroke.default, borderTopColor: theme.border },
  resultRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: Stroke.default,
    borderBottomColor: theme.border,
  },
  resultRowSelected: { backgroundColor: theme.surfaceRaised },
  resultTextWrap: { flex: 1, minWidth: 0 },
  resultTitle: { color: theme.textPrimary, ...Typography.bodyStrong },
  resultDescription: { color: theme.textMuted, ...Typography.caption, marginTop: 2 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: Radius.pill,
    borderWidth: Stroke.strong,
    borderColor: theme.borderStrong,
  },
  radioSelected: { borderWidth: 5, borderColor: theme.action },
  projectRow: {
    minHeight: 58,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderBottomWidth: Stroke.default,
    borderBottomColor: theme.border,
  },
  infoBlock: {
    paddingVertical: Spacing.md,
    borderTopWidth: Stroke.default,
    borderBottomWidth: Stroke.default,
    borderColor: theme.border,
  },
  infoTitle: { color: theme.textPrimary, ...Typography.bodyStrong },
  infoText: { color: theme.textMuted, ...Typography.caption, marginTop: 2 },
  actions: { marginTop: Spacing.xl },
});
