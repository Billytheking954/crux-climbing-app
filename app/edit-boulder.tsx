import { SafeAreaView } from 'react-native-safe-area-context';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import {
  useCallback,
  useEffect,
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

import {
  AppButton,
} from '@/components/core/AppButton';
import {
  Skeleton,
} from '@/components/core/Skeleton';

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
  deleteBoulder,
  getProjects,
  getSessionById,
  updateBoulder,
  type Boulder,
  type BoulderResult,
  type ClimbingProject,
} from '@/data/storage';

import {
  confirmAction,
  showMessage,
} from '@/utils/dialogs';

import {
  adjustAttemptsForResult,
  BOULDER_RESULTS,
  formatVGrade,
  HOLD_TYPES,
  isTerrain,
  isValidGradeRange,
  MOVEMENT_TYPES,
  normalizeSelections,
  parseVGrade,
  resolveRouteParam,
  resultSupportsProjectLink,
  TERRAINS,
  V_GRADES,
  validateAttempts,
  type GradeMode,
  type Terrain,
  type VGrade,
} from '@/utils/climbing';

const scheme =
  DefaultCruxScheme;

const theme =
  CruxTheme[scheme];

function FieldHeader({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <View
      style={
        styles.fieldHeader
      }
    >
      <Text
        style={
          styles.fieldTitle
        }
      >
        {title}
      </Text>

      {hint ? (
        <Text
          style={
            styles.fieldHint
          }
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function ChoiceButton({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{
        selected,
        disabled,
      }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.choiceButton,
        selected &&
          styles.choiceButtonSelected,
        {
          opacity:
            disabled
              ? 0.4
              : pressed
                ? 0.65
                : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.choiceText,
          selected &&
            styles.choiceTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function GradeStrip({
  value,
  onChange,
  disabled,
}: {
  value: VGrade;
  onChange: (
    value: VGrade,
  ) => void;
  disabled?: boolean;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={
        false
      }
      contentContainerStyle={
        styles.gradeStrip
      }
    >
      {V_GRADES.map(
        (item) => (
          <ChoiceButton
            key={item}
            label={item}
            selected={
              value === item
            }
            onPress={() =>
              onChange(item)
            }
            disabled={disabled}
          />
        ),
      )}
    </ScrollView>
  );
}

export default function EditBoulderScreen() {
  const params =
    useLocalSearchParams<{
      sessionId?:
        | string
        | string[];
      boulderId?:
        | string
        | string[];
    }>();

  const resolvedSessionId =
    resolveRouteParam(
      params.sessionId,
    );

  const resolvedBoulderId =
    resolveRouteParam(
      params.boulderId,
    );

  const [
    boulder,
    setBoulder,
  ] =
    useState<Boulder | null>(
      null,
    );

  const [
    projects,
    setProjects,
  ] =
    useState<
      ClimbingProject[]
    >([]);

  const [
    boulderName,
    setBoulderName,
  ] = useState('');

  const [
    gradeMode,
    setGradeMode,
  ] =
    useState<GradeMode>(
      'single',
    );

  const [
    grade,
    setGrade,
  ] =
    useState<VGrade>('V4');

  const [
    gradeStart,
    setGradeStart,
  ] =
    useState<VGrade>('V4');

  const [
    gradeEnd,
    setGradeEnd,
  ] =
    useState<VGrade>('V5');

  const [
    result,
    setResult,
  ] =
    useState<BoulderResult>(
      'Flash',
    );

  const [
    attempts,
    setAttempts,
  ] = useState('1');

  const [
    terrain,
    setTerrain,
  ] =
    useState<Terrain>(
      'Vertical',
    );

  const [
    selectedHoldTypes,
    setSelectedHoldTypes,
  ] =
    useState<string[]>([
      'Crimp',
    ]);

  const [
    selectedMovementTypes,
    setSelectedMovementTypes,
  ] =
    useState<string[]>([
      'Technical',
    ]);

  const [
    selectedProjectId,
    setSelectedProjectId,
  ] =
    useState<
      string | undefined
    >(undefined);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const loadData =
    useCallback(
      async () => {
        if (
          !resolvedSessionId ||
          !resolvedBoulderId
        ) {
          setLoading(false);
          return;
        }

        try {
          const [
            session,
            savedProjects,
          ] = await Promise.all([
            getSessionById(
              resolvedSessionId,
            ),
            getProjects(),
          ]);

          const foundBoulder =
            session?.boulders.find(
              (item) =>
                item.id ===
                resolvedBoulderId,
            ) ?? null;

          if (!foundBoulder) {
            setBoulder(null);
            setProjects(
              savedProjects,
            );

            return;
          }

          setBoulder(
            foundBoulder,
          );

          const relatedProjects =
            savedProjects.filter(
              (project) =>
                project.status ===
                  'active' ||
                project.id ===
                  foundBoulder.projectId,
            );

          setProjects(
            relatedProjects,
          );

          const parsedGrade =
            parseVGrade(
              String(
                foundBoulder.grade,
              ),
            );

          if (parsedGrade) {
            if (
              parsedGrade.start ===
              parsedGrade.end
            ) {
              setGradeMode(
                'single',
              );

              setGrade(
                parsedGrade.start,
              );
            } else {
              setGradeMode(
                'range',
              );

              setGradeStart(
                parsedGrade.start,
              );

              setGradeEnd(
                parsedGrade.end,
              );
            }
          } else {
            setGradeMode(
              'single',
            );

            setGrade('V0');
          }

          setBoulderName(
            foundBoulder.name
              ? String(
                  foundBoulder.name,
                )
              : '',
          );

          setResult(
            foundBoulder.result,
          );

          setAttempts(
            String(
              foundBoulder.attempts,
            ),
          );

          const foundTerrain =
            String(
              foundBoulder.terrain,
            );

          setTerrain(
            isTerrain(
              foundTerrain,
            )
              ? foundTerrain
              : 'Vertical',
          );

          setSelectedHoldTypes(
            normalizeSelections(
              foundBoulder.holdType,
              HOLD_TYPES,
              'Crimp',
            ),
          );

          setSelectedMovementTypes(
            normalizeSelections(
              foundBoulder.movementType,
              MOVEMENT_TYPES,
              'Technical',
            ),
          );

          setSelectedProjectId(
            foundBoulder.projectId,
          );
        } catch (error) {
          console.error(
            'Failed to load boulder:',
            error,
          );
        } finally {
          setLoading(false);
        }
      },
      [
        resolvedSessionId,
        resolvedBoulderId,
      ],
    );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const refreshProjects =
    useCallback(
      async () => {
        if (loading) {
          return;
        }

        try {
          const savedProjects =
            await getProjects();

          const relatedProjects =
            savedProjects.filter(
              (project) =>
                project.status ===
                  'active' ||
                project.id ===
                  boulder?.projectId,
            );

          setProjects(
            relatedProjects,
          );

          setSelectedProjectId(
            (current) =>
              current &&
              relatedProjects.some(
                (project) =>
                  project.id ===
                  current,
              )
                ? current
                : undefined,
          );
        } catch (error) {
          console.error(
            'Failed to refresh projects:',
            error,
          );
        }
      },
      [
        loading,
        boulder?.projectId,
      ],
    );

  useFocusEffect(
    useCallback(() => {
      void refreshProjects();
    }, [refreshProjects]),
  );

  const selectedGrade =
    gradeMode === 'single'
      ? grade
      : formatVGrade(
          gradeStart,
          gradeEnd,
        );

  const canLinkProject =
    resultSupportsProjectLink(
      result,
    );

  const selectedProject =
    canLinkProject
      ? projects.find(
          (project) =>
            project.id ===
            selectedProjectId,
        )
      : undefined;

  const selectResult = (
    nextResult: BoulderResult,
  ) => {
    setResult(nextResult);

    if (
      !resultSupportsProjectLink(
        nextResult,
      )
    ) {
      setSelectedProjectId(
        undefined,
      );
    }

    setAttempts(
      (current) =>
        adjustAttemptsForResult(
          nextResult,
          current,
        ),
    );
  };

  const toggleHoldType = (
    value: string,
  ) => {
    setSelectedHoldTypes(
      (current) =>
        current.includes(value)
          ? current.filter(
              (item) =>
                item !== value,
            )
          : [
              ...current,
              value,
            ],
    );
  };

  const toggleMovementType = (
    value: string,
  ) => {
    setSelectedMovementTypes(
      (current) =>
        current.includes(value)
          ? current.filter(
              (item) =>
                item !== value,
            )
          : [
              ...current,
              value,
            ],
    );
  };

  const saveChanges =
    async () => {
      if (
        saving ||
        !resolvedSessionId ||
        !resolvedBoulderId
      ) {
        return;
      }

      const attemptValidation =
        validateAttempts(
          result,
          attempts,
        );

      if (
        !attemptValidation.ok
      ) {
        showMessage(
          'Invalid attempts',
          attemptValidation.error,
        );

        return;
      }

      if (
        selectedHoldTypes.length ===
        0
      ) {
        showMessage(
          'Select a hold type',
          'Choose at least one hold type.',
        );

        return;
      }

      if (
        selectedMovementTypes.length ===
        0
      ) {
        showMessage(
          'Select a movement',
          'Choose at least one movement type.',
        );

        return;
      }

      if (
        gradeMode ===
          'range' &&
        !isValidGradeRange(
          gradeStart,
          gradeEnd,
        )
      ) {
        showMessage(
          'Invalid grade range',
          'The first grade cannot be harder than the second grade.',
        );

        return;
      }

      try {
        setSaving(true);

        if (
          canLinkProject &&
          selectedProjectId
        ) {
          const latestProjects =
            await getProjects();

          const linkedProject =
            latestProjects.find(
              (project) =>
                project.id ===
                selectedProjectId,
            );

          const isOriginalProject =
            selectedProjectId ===
            boulder?.projectId;

          if (!linkedProject) {
            setSelectedProjectId(
              undefined,
            );

            showMessage(
              'Project no longer exists',
              'Choose another project or save the boulder without a project link.',
            );

            return;
          }

          if (
            linkedProject.status !==
              'active' &&
            !isOriginalProject
          ) {
            setSelectedProjectId(
              undefined,
            );

            showMessage(
              'Project no longer active',
              'Choose an active project or save the boulder without a project link.',
            );

            return;
          }
        }

        await updateBoulder(
          resolvedSessionId,
          resolvedBoulderId,
          {
            name:
              boulderName.trim() ||
              undefined,

            grade:
              selectedGrade,

            result,

            attempts:
              attemptValidation.value,

            terrain,

            holdType:
              selectedHoldTypes,

            movementType:
              selectedMovementTypes,

            projectId:
              canLinkProject
                ? selectedProjectId
                : undefined,
          },
        );

        router.back();
      } catch (error) {
        console.error(
          'Failed to update boulder:',
          error,
        );

        showMessage(
          'Could not update boulder',
          'Something went wrong while saving your changes.',
        );
      } finally {
        setSaving(false);
      }
    };

  const confirmDelete =
    async () => {
      if (
        saving ||
        !resolvedSessionId ||
        !resolvedBoulderId
      ) {
        return;
      }

      const confirmed =
        await confirmAction({
          title:
            'Delete boulder?',
          message:
            'This cannot be undone.',
          confirmText:
            'Delete',
          cancelText:
            'Cancel',
          destructive:
            true,
        });

      if (!confirmed) {
        return;
      }

      try {
        setSaving(true);

        await deleteBoulder(
          resolvedSessionId,
          resolvedBoulderId,
        );

        router.back();
      } catch (error) {
        console.error(
          'Failed to delete boulder:',
          error,
        );

        showMessage(
          'Could not delete boulder',
          'Something went wrong.',
        );
      } finally {
        setSaving(false);
      }
    };

  if (loading) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
      >
        <View
          style={
            styles.loadingContainer
          }
        >
          <Skeleton
            scheme={scheme}
            height={32}
            width="55%"
          />

          <Skeleton
            scheme={scheme}
            height={50}
          />

          <Skeleton
            scheme={scheme}
            height={100}
          />

          <Skeleton
            scheme={scheme}
            height={180}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!boulder) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
      >
        <View
          style={
            styles.notFound
          }
        >
          <Text
            style={
              styles.notFoundTitle
            }
          >
            Boulder not found
          </Text>

          <Text
            style={
              styles.notFoundText
            }
          >
            This boulder may have been removed from the session.
          </Text>

          <AppButton
            label="Go back"
            variant="secondary"
            scheme={scheme}
            onPress={() =>
              router.back()
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  const attemptsHint =
    result === 'Flash'
      ? 'A flash is always 1 attempt.'
      : result === 'Send'
        ? 'A send requires at least 2 attempts.'
        : undefined;

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
    >
      <ScrollView
        style={
          styles.container
        }
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={
            styles.inner
          }
        >
          <View
            style={
              styles.header
            }
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() =>
                router.back()
              }
              disabled={saving}
              style={({ pressed }) => [
                styles.backButton,
                {
                  opacity:
                    saving
                      ? 0.4
                      : pressed
                        ? 0.55
                        : 1,
                },
              ]}
            >
              <Text
                style={
                  styles.backText
                }
              >
                ‹
              </Text>
            </Pressable>

            <View
              style={
                styles.headerText
              }
            >
              <Text
                style={
                  styles.title
                }
              >
                Edit boulder
              </Text>

              <Text
                style={
                  styles.subtitle
                }
              >
                Update the logged climb
              </Text>
            </View>
          </View>

          <FieldHeader
            title="Boulder name"
            hint="Optional"
          />

          <TextInput
            value={
              boulderName
            }
            onChangeText={
              setBoulderName
            }
            placeholder="Blue arete"
            placeholderTextColor={
              theme.textMuted
            }
            style={
              styles.input
            }
            editable={!saving}
            autoCapitalize="words"
            maxLength={60}
          />

          <FieldHeader
            title="Grade"
          />

          <View
            style={
              styles.segmented
            }
          >
            <Pressable
              onPress={() =>
                setGradeMode(
                  'single',
                )
              }
              style={[
                styles.segment,
                gradeMode ===
                  'single' &&
                  styles.segmentSelected,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  gradeMode ===
                    'single' &&
                    styles.segmentTextSelected,
                ]}
              >
                Single
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                setGradeMode(
                  'range',
                )
              }
              style={[
                styles.segment,
                gradeMode ===
                  'range' &&
                  styles.segmentSelected,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  gradeMode ===
                    'range' &&
                    styles.segmentTextSelected,
                ]}
              >
                Range
              </Text>
            </Pressable>
          </View>

          {gradeMode ===
          'single' ? (
            <GradeStrip
              value={grade}
              onChange={
                setGrade
              }
              disabled={saving}
            />
          ) : (
            <>
              <Text
                style={
                  styles.smallLabel
                }
              >
                From
              </Text>

              <GradeStrip
                value={
                  gradeStart
                }
                onChange={
                  setGradeStart
                }
                disabled={saving}
              />

              <Text
                style={
                  styles.smallLabel
                }
              >
                To
              </Text>

              <GradeStrip
                value={
                  gradeEnd
                }
                onChange={
                  setGradeEnd
                }
                disabled={saving}
              />
            </>
          )}

          <View
            style={
              styles.selectedGradeRow
            }
          >
            <Text
              style={
                styles.selectedGradeLabel
              }
            >
              Selected grade
            </Text>

            <Text
              style={
                styles.selectedGrade
              }
            >
              {selectedGrade}
            </Text>
          </View>

          <FieldHeader
            title="Result"
          />

          <View
            style={
              styles.resultList
            }
          >
            {BOULDER_RESULTS.map(
              (item) => {
                const selected =
                  result ===
                  item.value;

                return (
                  <Pressable
                    key={
                      item.value
                    }
                    onPress={() =>
                      selectResult(
                        item.value,
                      )
                    }
                    disabled={saving}
                    style={({
                      pressed,
                    }) => [
                      styles.resultRow,
                      selected &&
                        styles.resultRowSelected,
                      {
                        opacity:
                          saving
                            ? 0.4
                            : pressed
                              ? 0.65
                              : 1,
                      },
                    ]}
                  >
                    <View
                      style={
                        styles.resultText
                      }
                    >
                      <Text
                        style={[
                          styles.resultTitle,
                          selected &&
                            styles.resultTitleSelected,
                        ]}
                      >
                        {item.label}
                      </Text>

                      <Text
                        style={
                          styles.resultDescription
                        }
                      >
                        {
                          item.description
                        }
                      </Text>
                    </View>

                    {selected ? (
                      <Text
                        style={
                          styles.selectedText
                        }
                      >
                        Selected
                      </Text>
                    ) : null}
                  </Pressable>
                );
              },
            )}
          </View>

          <FieldHeader
            title="Attempts"
            hint={
              attemptsHint
            }
          />

          <TextInput
            value={attempts}
            onChangeText={
              setAttempts
            }
            keyboardType="number-pad"
            style={
              styles.input
            }
            placeholder="1"
            placeholderTextColor={
              theme.textMuted
            }
            editable={
              !saving &&
              result !== 'Flash'
            }
          />

          <FieldHeader
            title="Terrain"
          />

          <View
            style={
              styles.choiceGrid
            }
          >
            {TERRAINS.map(
              (item) => (
                <ChoiceButton
                  key={item}
                  label={item}
                  selected={
                    terrain === item
                  }
                  onPress={() =>
                    setTerrain(
                      item,
                    )
                  }
                  disabled={saving}
                />
              ),
            )}
          </View>

          <FieldHeader
            title="Hold types"
            hint="Select all that apply"
          />

          <View
            style={
              styles.choiceGrid
            }
          >
            {HOLD_TYPES.map(
              (item) => (
                <ChoiceButton
                  key={item}
                  label={item}
                  selected={selectedHoldTypes.includes(
                    item,
                  )}
                  onPress={() =>
                    toggleHoldType(
                      item,
                    )
                  }
                  disabled={saving}
                />
              ),
            )}
          </View>

          <FieldHeader
            title="Movement"
            hint="Select all that apply"
          />

          <View
            style={
              styles.choiceGrid
            }
          >
            {MOVEMENT_TYPES.map(
              (item) => (
                <ChoiceButton
                  key={item}
                  label={item}
                  selected={selectedMovementTypes.includes(
                    item,
                  )}
                  onPress={() =>
                    toggleMovementType(
                      item,
                    )
                  }
                  disabled={saving}
                />
              ),
            )}
          </View>

          {canLinkProject ? (
            <>
              <FieldHeader
                title="Project"
                hint="Optional"
              />

              {projects.length ===
              0 ? (
                <View
                  style={
                    styles.emptyProject
                  }
                >
                  <Text
                    style={
                      styles.emptyProjectTitle
                    }
                  >
                    No projects available
                  </Text>

                  <Text
                    style={
                      styles.emptyProjectText
                    }
                  >
                    Save without a project or create one from the Projects tab.
                  </Text>

                  <AppButton
                    label="Open Projects"
                    variant="secondary"
                    compact
                    scheme={scheme}
                    disabled={saving}
                    onPress={() =>
                      router.push(
                        '/(tabs)/projects',
                      )
                    }
                  />
                </View>
              ) : (
                <View
                  style={
                    styles.projectList
                  }
                >
                  {projects.map(
                    (project) => {
                      const selected =
                        selectedProjectId ===
                        project.id;

                      return (
                        <Pressable
                          key={
                            project.id
                          }
                          onPress={() =>
                            setSelectedProjectId(
                              selected
                                ? undefined
                                : project.id,
                            )
                          }
                          disabled={saving}
                          style={({
                            pressed,
                          }) => [
                            styles.projectRow,
                            selected &&
                              styles.projectRowSelected,
                            {
                              opacity:
                                pressed
                                  ? 0.65
                                  : 1,
                            },
                          ]}
                        >
                          <View
                            style={
                              styles.projectGrade
                            }
                          >
                            <Text
                              style={
                                styles.projectGradeText
                              }
                            >
                              {
                                project.grade
                              }
                            </Text>
                          </View>

                          <View
                            style={
                              styles.projectContent
                            }
                          >
                            <Text
                              numberOfLines={
                                1
                              }
                              style={
                                styles.projectName
                              }
                            >
                              {
                                project.name
                              }
                            </Text>

                            <Text
                              style={
                                styles.projectMeta
                              }
                            >
                              {selected
                                ? 'Linked'
                                : project.status ===
                                    'completed'
                                  ? 'Completed project'
                                  : 'Tap to link'}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    },
                  )}
                </View>
              )}

              {selectedProject ? (
                <Text
                  style={
                    styles.linkedProjectText
                  }
                >
                  Linked to{' '}
                  {
                    selectedProject.name
                  }
                </Text>
              ) : null}
            </>
          ) : null}

          <View
            style={
              styles.actions
            }
          >
            <AppButton
              label="Save changes"
              loading={saving}
              scheme={scheme}
              onPress={() => {
                void saveChanges();
              }}
            />

            <AppButton
              label="Delete boulder"
              variant="destructive"
              disabled={saving}
              scheme={scheme}
              onPress={() => {
                void confirmDelete();
              }}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        theme.background,
    },

    container: {
      flex: 1,
      backgroundColor:
        theme.background,
    },

    content: {
      paddingHorizontal:
        Layout.horizontalPadding,
      paddingTop:
        Spacing.sm,
      paddingBottom:
        Spacing.xxxl,
    },

    inner: {
      width: '100%',
      maxWidth:
        Layout.maxContentWidth,
      alignSelf: 'center',
    },

    loadingContainer: {
      flex: 1,
      gap: Spacing.md,
      padding:
        Layout.horizontalPadding,
      paddingTop:
        Spacing.xxl,
    },

    notFound: {
      flex: 1,
      justifyContent:
        'center',
      padding:
        Layout.horizontalPadding,
      gap: Spacing.sm,
    },

    notFoundTitle: {
      color:
        theme.textPrimary,
      ...Typography.title,
    },

    notFoundText: {
      color:
        theme.textMuted,
      ...Typography.body,
      marginBottom:
        Spacing.md,
    },

    header: {
      minHeight: 60,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom:
        Spacing.lg,
    },

    backButton: {
      width:
        Size.touchTarget,
      height:
        Size.touchTarget,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    backText: {
      color:
        theme.textPrimary,
      fontSize: 34,
      lineHeight: 36,
      fontWeight: '300',
      marginTop: -2,
    },

    headerText: {
      flex: 1,
    },

    title: {
      color:
        theme.textPrimary,
      ...Typography.title,
    },

    subtitle: {
      color:
        theme.textMuted,
      ...Typography.caption,
      marginTop:
        Spacing.xxs,
    },

    fieldHeader: {
      marginTop:
        Spacing.lg,
      marginBottom:
        Spacing.xs,
    },

    fieldTitle: {
      color:
        theme.textPrimary,
      ...Typography.subheading,
    },

    fieldHint: {
      color:
        theme.textMuted,
      ...Typography.caption,
      marginTop: 2,
    },

    input: {
      minHeight:
        Size.input,
      borderWidth:
        Stroke.default,
      borderColor:
        theme.borderStrong,
      borderRadius:
        Radius.md,
      backgroundColor:
        theme.surface,
      color:
        theme.textPrimary,
      paddingHorizontal:
        Spacing.md,
      ...Typography.body,
    },

    segmented: {
      flexDirection: 'row',
      backgroundColor:
        theme.surfacePressed,
      borderRadius:
        Radius.md,
      padding:
        Spacing.xxs,
      marginBottom:
        Spacing.sm,
    },

    segment: {
      flex: 1,
      minHeight: 40,
      alignItems: 'center',
      justifyContent:
        'center',
      borderRadius:
        Radius.sm,
    },

    segmentSelected: {
      backgroundColor:
        theme.surface,
      borderWidth: 1,
      borderColor:
        theme.border,
    },

    segmentText: {
      color:
        theme.textMuted,
      ...Typography.bodyStrong,
      fontSize: 14,
    },

    segmentTextSelected: {
      color:
        theme.textPrimary,
    },

    smallLabel: {
      color:
        theme.textMuted,
      ...Typography.caption,
      marginTop:
        Spacing.sm,
      marginBottom:
        Spacing.xs,
    },

    gradeStrip: {
      gap: Spacing.xs,
      paddingRight:
        Spacing.md,
      paddingBottom:
        Spacing.xxs,
    },

    choiceGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },

    choiceButton: {
      minHeight:
        Size.touchTarget,
      minWidth: 52,
      paddingHorizontal:
        Spacing.sm,
      alignItems: 'center',
      justifyContent:
        'center',
      borderWidth:
        Stroke.default,
      borderColor:
        theme.borderStrong,
      borderRadius:
        Radius.md,
      backgroundColor:
        theme.surface,
    },

    choiceButtonSelected: {
      backgroundColor:
        theme.action,
      borderColor:
        theme.action,
    },

    choiceText: {
      color:
        theme.textSecondary,
      ...Typography.bodyStrong,
      fontSize: 14,
    },

    choiceTextSelected: {
      color:
        theme.actionText,
    },

    selectedGradeRow: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      borderBottomWidth:
        Stroke.default,
      borderBottomColor:
        theme.border,
      marginTop:
        Spacing.sm,
    },

    selectedGradeLabel: {
      color:
        theme.textMuted,
      ...Typography.caption,
    },

    selectedGrade: {
      color:
        theme.textPrimary,
      ...Typography.heading,
    },

    resultList: {
      borderTopWidth:
        Stroke.default,
      borderTopColor:
        theme.border,
    },

    resultRow: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      borderBottomWidth:
        Stroke.default,
      borderBottomColor:
        theme.border,
      paddingVertical:
        Spacing.xs,
      paddingHorizontal:
        Spacing.xxs,
    },

    resultRowSelected: {
      backgroundColor:
        theme.surfacePressed,
    },

    resultText: {
      flex: 1,
    },

    resultTitle: {
      color:
        theme.textPrimary,
      ...Typography.bodyStrong,
    },

    resultTitleSelected: {
      color:
        theme.action,
    },

    resultDescription: {
      color:
        theme.textMuted,
      ...Typography.caption,
      marginTop: 2,
    },

    selectedText: {
      color:
        theme.action,
      ...Typography.label,
    },

    emptyProject: {
      gap: Spacing.xs,
      paddingVertical:
        Spacing.md,
      borderTopWidth:
        Stroke.default,
      borderBottomWidth:
        Stroke.default,
      borderColor:
        theme.border,
    },

    emptyProjectTitle: {
      color:
        theme.textPrimary,
      ...Typography.bodyStrong,
    },

    emptyProjectText: {
      color:
        theme.textMuted,
      ...Typography.body,
      marginBottom:
        Spacing.xs,
    },

    projectList: {
      borderTopWidth:
        Stroke.default,
      borderTopColor:
        theme.border,
    },

    projectRow: {
      minHeight: 62,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      borderBottomWidth:
        Stroke.default,
      borderBottomColor:
        theme.border,
      paddingVertical:
        Spacing.xs,
      paddingHorizontal:
        Spacing.xxs,
    },

    projectRowSelected: {
      backgroundColor:
        theme.projectSurface,
    },

    projectGrade: {
      minWidth: 48,
      minHeight: 32,
      alignItems: 'center',
      justifyContent:
        'center',
      borderRadius:
        Radius.sm,
      backgroundColor:
        theme.surfaceRaised,
      borderWidth: 1,
      borderColor:
        theme.borderStrong,
    },

    projectGradeText: {
      color:
        theme.textPrimary,
      ...Typography.label,
    },

    projectContent: {
      flex: 1,
      minWidth: 0,
    },

    projectName: {
      color:
        theme.textPrimary,
      ...Typography.bodyStrong,
    },

    projectMeta: {
      color:
        theme.textMuted,
      ...Typography.caption,
      marginTop: 2,
    },

    linkedProjectText: {
      color:
        theme.project,
      ...Typography.caption,
      marginTop:
        Spacing.xs,
    },

    actions: {
      gap: Spacing.sm,
      marginTop:
        Spacing.xxl,
    },
  });