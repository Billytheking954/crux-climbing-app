import {
  useFocusEffect,
} from 'expo-router';
import {
  useCallback,
  useMemo,
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
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  AppButton,
} from '@/components/core/AppButton';
import {
  SectionHeader,
} from '@/components/core/SectionHeader';
import {
  Skeleton,
} from '@/components/core/Skeleton';

import {
  CruxTheme,
  Fonts,
  Layout,
  Radius,
  Size,
  Spacing,
  Stroke,
  Typography,
  type CruxColorScheme,
} from '@/constants/theme';

import {
  createGoal,
  deleteGoal,
  getGoals,
  getHighestGrade,
  getSessions,
  gradeToNumber,
  saveGoals,
  type ClimbingGoal,
  type ClimbingSession,
} from '@/data/storage';

import {
  confirmAction,
  showMessage,
} from '@/utils/dialogs';

const scheme: CruxColorScheme =
  'light';

const theme =
  CruxTheme.light;

type GoalState = {
  progress: number;
  percent: number;
  complete: boolean;
  currentLabel: string;
};

function getFinishedSessions(
  sessions: ClimbingSession[],
): ClimbingSession[] {
  return sessions.filter(
    (session) =>
      Boolean(
        session.finishedAt,
      ),
  );
}

function getGoalState(
  goal: ClimbingGoal,
  sessions: ClimbingSession[],
): GoalState {
  const finishedSessions =
    getFinishedSessions(
      sessions,
    );

  const allBoulders =
    finishedSessions.flatMap(
      (session) =>
        session.boulders,
    );

  if (
    goal.type === 'grade'
  ) {
    const highestGrade =
      getHighestGrade(
        allBoulders,
      );

    if (!highestGrade) {
      return {
        progress: -1,
        percent: 0,
        complete: false,
        currentLabel: '—',
      };
    }

    const currentGrade =
      gradeToNumber(
        highestGrade,
      );

    const complete =
      currentGrade >=
      goal.target;

    return {
      progress:
        currentGrade,
      percent:
        complete
          ? 100
          : 0,
      complete,
      currentLabel:
        highestGrade,
    };
  }

  let progress = 0;

  switch (goal.type) {
    case 'sessions':
      progress =
        finishedSessions.length;
      break;

    case 'boulders':
      progress =
        allBoulders.length;
      break;

    case 'flashes':
      progress =
        allBoulders.filter(
          (boulder) =>
            boulder.result ===
            'Flash',
        ).length;
      break;

    case 'sends':
      progress =
        allBoulders.filter(
          (boulder) =>
            boulder.result ===
            'Send',
        ).length;
      break;

    default:
      progress = 0;
  }

  const complete =
    progress >=
    goal.target;

  return {
    progress,

    percent:
      Math.min(
        100,
        Math.round(
          (progress /
            goal.target) *
            100,
        ),
      ),

    complete,

    currentLabel:
      `${progress} / ${goal.target}`,
  };
}

function getGoalCompletionDate(
  goal: ClimbingGoal,
  sessions: ClimbingSession[],
): string | undefined {
  const finishedSessions =
    getFinishedSessions(
      sessions,
    )
      .slice()
      .sort(
        (a, b) =>
          new Date(
            a.finishedAt!,
          ).getTime() -
          new Date(
            b.finishedAt!,
          ).getTime(),
      );

  const cumulativeSessions:
    ClimbingSession[] =
      [];

  for (
    const session of
    finishedSessions
  ) {
    cumulativeSessions.push(
      session,
    );

    if (
      getGoalState(
        goal,
        cumulativeSessions,
      ).complete
    ) {
      return session.finishedAt;
    }
  }

  return undefined;
}

function syncGoalCompletionDates(
  goals: ClimbingGoal[],
  sessions: ClimbingSession[],
): {
  goals: ClimbingGoal[];
  changed: boolean;
} {
  let changed =
    false;

  const syncedGoals =
    goals.map(
      (goal) => {
        const completedAt =
          getGoalCompletionDate(
            goal,
            sessions,
          );

        if (
          goal.completedAt ===
          completedAt
        ) {
          return goal;
        }

        changed = true;

        return {
          ...goal,
          completedAt,
        };
      },
    );

  return {
    goals:
      syncedGoals,
    changed,
  };
}

function getGoalDisplay(
  goal: ClimbingGoal,
): string {
  return (
    goal.type === 'grade'
      ? `V${goal.target}`
      : `${goal.target}`
  );
}

function formatCompletionDate(
  dateString: string,
): string {
  return new Date(
    dateString,
  ).toLocaleDateString(
    'en-GB',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
  );
}

function formatSessionDuration(
  session: ClimbingSession,
): string {
  if (!session.finishedAt) {
    return '—';
  }

  const difference =
    new Date(
      session.finishedAt,
    ).getTime() -
    new Date(
      session.startedAt,
    ).getTime();

  const totalMinutes =
    Math.max(
      0,
      Math.floor(
        difference / 60000,
      ),
    );

  const hours =
    Math.floor(
      totalMinutes / 60,
    );

  const minutes =
    totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

function GoalTypeButton({
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
        styles.typeButton,
        selected &&
          styles.typeButtonSelected,
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
          styles.typeButtonText,
          selected &&
            styles.typeButtonTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function RecordRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View
      style={
        styles.recordRow
      }
    >
      <Text
        style={
          styles.recordLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.recordValue
        }
      >
        {value}
      </Text>
    </View>
  );
}

export default function GoalsScreen() {
  const [
    goals,
    setGoals,
  ] =
    useState<
      ClimbingGoal[]
    >([]);

  const [
    sessions,
    setSessions,
  ] =
    useState<
      ClimbingSession[]
    >([]);

  const [
    showCreate,
    setShowCreate,
  ] =
    useState(false);

  const [
    goalTitle,
    setGoalTitle,
  ] =
    useState('');

  const [
    goalTarget,
    setGoalTarget,
  ] =
    useState('');

  const [
    goalType,
    setGoalType,
  ] =
    useState<
      ClimbingGoal['type']
    >(
      'boulders',
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    mutating,
    setMutating,
  ] =
    useState(false);

  const [
    loadError,
    setLoadError,
  ] =
    useState<
      string | null
    >(null);

  const loadGoals =
    useCallback(
      async () => {
        try {
          setLoadError(null);

          const [
            savedGoals,
            savedSessions,
          ] =
            await Promise.all([
              getGoals(),
              getSessions(),
            ]);

          const synced =
            syncGoalCompletionDates(
              savedGoals,
              savedSessions,
            );

          if (
            synced.changed
          ) {
            await saveGoals(
              synced.goals,
            );
          }

          setGoals(
            synced.goals,
          );

          setSessions(
            savedSessions,
          );
        } catch (error) {
          console.error(
            'Failed to load goals:',
            error,
          );

          setLoadError(
            'CRUX could not load your goals.',
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  useFocusEffect(
    useCallback(() => {
      void loadGoals();
    }, [loadGoals]),
  );

  const createNewGoal =
    async () => {
      if (mutating) {
        return;
      }

      const cleanTarget =
        goalTarget.trim();

      const target =
        Number(
          cleanTarget,
        );

      if (
        !goalTitle.trim()
      ) {
        showMessage(
          'Goal name required',
          'Give your goal a name.',
        );

        return;
      }

      if (!cleanTarget) {
        showMessage(
          'Target required',
          goalType ===
          'grade'
            ? 'Enter 0 for V0, 4 for V4, and so on.'
            : 'Enter a target number.',
        );

        return;
      }

      if (
        !Number.isFinite(
          target,
        ) ||
        !Number.isInteger(
          target,
        )
      ) {
        showMessage(
          'Invalid target',
          'Enter a whole number.',
        );

        return;
      }

      if (
        goalType ===
        'grade'
          ? target < 0
          : target <= 0
      ) {
        showMessage(
          goalType ===
          'grade'
            ? 'Invalid grade'
            : 'Invalid target',

          goalType ===
          'grade'
            ? 'Enter 0 for V0, 4 for V4, and so on.'
            : 'Enter a target greater than zero.',
        );

        return;
      }

      try {
        setMutating(true);

        await createGoal(
          goalType,
          goalTitle.trim(),
          target,
        );

        setGoalTitle('');
        setGoalTarget('');
        setShowCreate(false);

        await loadGoals();
      } catch (error) {
        console.error(
          'Failed to create goal:',
          error,
        );

        showMessage(
          'Could not create goal',
          'Something went wrong while saving your goal.',
        );
      } finally {
        setMutating(false);
      }
    };

  const confirmDeleteGoal =
    async (
      goal: ClimbingGoal,
    ) => {
      if (mutating) {
        return;
      }

      const confirmed =
        await confirmAction({
          title:
            'Delete goal?',
          message:
            goal.title,
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
        setMutating(true);

        await deleteGoal(
          goal.id,
        );

        await loadGoals();
      } catch (error) {
        console.error(
          'Failed to delete goal:',
          error,
        );

        showMessage(
          'Could not delete goal',
          'Something went wrong while deleting your goal.',
        );
      } finally {
        setMutating(false);
      }
    };

  const goalEntries =
    useMemo(
      () =>
        goals.map(
          (goal) => ({
            goal,

            state:
              getGoalState(
                goal,
                sessions,
              ),
          }),
        ),
      [
        goals,
        sessions,
      ],
    );

  const activeGoals =
    goalEntries.filter(
      (entry) =>
        !entry.state.complete,
    );

  const completedGoals =
    goalEntries.filter(
      (entry) =>
        entry.state.complete,
    );

  const personalBoulders =
    useMemo(
      () =>
        sessions
          .filter(
            (session) =>
              Boolean(
                session.finishedAt,
              ),
          )
          .flatMap(
            (session) =>
              session.boulders,
          ),
      [sessions],
    );

  const highestGrade =
    getHighestGrade(
      personalBoulders,
    );

  const hardestFlash =
    personalBoulders
      .filter(
        (boulder) =>
          boulder.result ===
          'Flash',
      )
      .sort(
        (a, b) =>
          gradeToNumber(
            b.grade,
          ) -
          gradeToNumber(
            a.grade,
          ),
      )[0]?.grade ??
    '—';

  const hardestSend =
    personalBoulders
      .filter(
        (boulder) =>
          boulder.result ===
          'Send',
      )
      .sort(
        (a, b) =>
          gradeToNumber(
            b.grade,
          ) -
          gradeToNumber(
            a.grade,
          ),
      )[0]?.grade ??
    '—';

  const mostProblemsSession =
    sessions
      .filter(
        (session) =>
          Boolean(
            session.finishedAt,
          ),
      )
      .reduce<
        ClimbingSession | null
      >(
        (
          best,
          current,
        ) => {
          if (!best) {
            return current;
          }

          return (
            current.boulders.length >
            best.boulders.length
              ? current
              : best
          );
        },
        null,
      );

  const longestSession =
    sessions
      .filter(
        (session) =>
          Boolean(
            session.finishedAt,
          ),
      )
      .reduce<
        ClimbingSession | null
      >(
        (
          best,
          current,
        ) => {
          if (!best) {
            return current;
          }

          const bestDuration =
            new Date(
              best.finishedAt!,
            ).getTime() -
            new Date(
              best.startedAt,
            ).getTime();

          const currentDuration =
            new Date(
              current.finishedAt!,
            ).getTime() -
            new Date(
              current.startedAt,
            ).getTime();

          return (
            currentDuration >
            bestDuration
              ? current
              : best
          );
        },
        null,
      );

  const totalAttempts =
    personalBoulders.reduce(
      (
        total,
        boulder,
      ) =>
        total +
        boulder.attempts,
      0,
    );

  const mostAttemptsOnOneBoulder =
    personalBoulders.reduce(
      (
        max,
        boulder,
      ) =>
        Math.max(
          max,
          boulder.attempts,
        ),
      0,
    );

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
      edges={['top']}
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
          style={styles.inner}
        >
          <View
            style={styles.header}
          >
            <Text
              style={styles.title}
            >
              Goals
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              Targets measured against your climbing history
            </Text>
          </View>

          <AppButton
            label={
              showCreate
                ? 'Cancel'
                : 'Create goal'
            }
            variant={
              showCreate
                ? 'secondary'
                : 'primary'
            }
            scheme={scheme}
            disabled={
              mutating
            }
            onPress={() =>
              setShowCreate(
                (value) =>
                  !value,
              )
            }
          />

          {showCreate ? (
            <View
              style={
                styles.createSection
              }
            >
              <View
                style={
                  styles.fieldGroup
                }
              >
                <Text
                  style={
                    styles.fieldLabel
                  }
                >
                  Goal name
                </Text>

                <TextInput
                  value={
                    goalTitle
                  }
                  onChangeText={
                    setGoalTitle
                  }
                  placeholder="Send my first V5"
                  placeholderTextColor={
                    theme.textMuted
                  }
                  style={
                    styles.input
                  }
                  editable={
                    !mutating
                  }
                  maxLength={80}
                />
              </View>

              <View
                style={
                  styles.fieldGroup
                }
              >
                <Text
                  style={
                    styles.fieldLabel
                  }
                >
                  Goal type
                </Text>

                <View
                  style={
                    styles.typeGrid
                  }
                >
                  <GoalTypeButton
                    label="Grade"
                    selected={
                      goalType ===
                      'grade'
                    }
                    onPress={() =>
                      setGoalType(
                        'grade',
                      )
                    }
                    disabled={
                      mutating
                    }
                  />

                  <GoalTypeButton
                    label="Sessions"
                    selected={
                      goalType ===
                      'sessions'
                    }
                    onPress={() =>
                      setGoalType(
                        'sessions',
                      )
                    }
                    disabled={
                      mutating
                    }
                  />

                  <GoalTypeButton
                    label="Boulders"
                    selected={
                      goalType ===
                      'boulders'
                    }
                    onPress={() =>
                      setGoalType(
                        'boulders',
                      )
                    }
                    disabled={
                      mutating
                    }
                  />

                  <GoalTypeButton
                    label="Flashes"
                    selected={
                      goalType ===
                      'flashes'
                    }
                    onPress={() =>
                      setGoalType(
                        'flashes',
                      )
                    }
                    disabled={
                      mutating
                    }
                  />

                  <GoalTypeButton
                    label="Sends"
                    selected={
                      goalType ===
                      'sends'
                    }
                    onPress={() =>
                      setGoalType(
                        'sends',
                      )
                    }
                    disabled={
                      mutating
                    }
                  />
                </View>
              </View>

              <View
                style={
                  styles.fieldGroup
                }
              >
                <Text
                  style={
                    styles.fieldLabel
                  }
                >
                  Target
                </Text>

                <TextInput
                  value={
                    goalTarget
                  }
                  onChangeText={
                    setGoalTarget
                  }
                  placeholder={
                    goalType ===
                    'grade'
                      ? '4 for V4'
                      : 'Target number'
                  }
                  placeholderTextColor={
                    theme.textMuted
                  }
                  keyboardType="number-pad"
                  style={
                    styles.input
                  }
                  editable={
                    !mutating
                  }
                />

                {goalType ===
                'grade' ? (
                  <Text
                    style={
                      styles.fieldHint
                    }
                  >
                    Grade goals compare your hardest achieved grade directly with the target.
                  </Text>
                ) : null}
              </View>

              <AppButton
                label="Save goal"
                loading={
                  mutating
                }
                scheme={scheme}
                onPress={() => {
                  void createNewGoal();
                }}
              />
            </View>
          ) : null}

          <SectionHeader
            title="Active goals"
            scheme={scheme}
          />

          {loading ? (
            <View
              style={
                styles.loadingStack
              }
            >
              <Skeleton
                scheme={scheme}
                height={88}
              />

              <Skeleton
                scheme={scheme}
                height={88}
              />

              <Skeleton
                scheme={scheme}
                height={88}
              />
            </View>
          ) : loadError ? (
            <View
              style={
                styles.emptyState
              }
            >
              <Text
                style={
                  styles.emptyTitle
                }
              >
                Couldn’t load goals
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                {loadError}
              </Text>
            </View>
          ) : activeGoals.length ===
            0 ? (
            <View
              style={
                styles.emptyState
              }
            >
              <Text
                style={
                  styles.emptyTitle
                }
              >
                No active goals
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Create a target and CRUX will measure it from completed sessions.
              </Text>
            </View>
          ) : (
            <View
              style={
                styles.goalList
              }
            >
              {activeGoals.map(
                ({
                  goal,
                  state,
                }) => {
                  const barWidth =
                    `${state.percent}%` as `${number}%`;

                  return (
                    <View
                      key={
                        goal.id
                      }
                      style={
                        styles.goalRow
                      }
                    >
                      <View
                        style={
                          styles.goalHeader
                        }
                      >
                        <View
                          style={
                            styles.goalHeaderText
                          }
                        >
                          <Text
                            style={
                              styles.goalTitle
                            }
                          >
                            {
                              goal.title
                            }
                          </Text>

                          <Text
                            style={
                              styles.goalTarget
                            }
                          >
                            Target{' '}
                            {getGoalDisplay(
                              goal,
                            )}
                          </Text>
                        </View>

                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Delete ${goal.title}`}
                          onPress={() => {
                            void confirmDeleteGoal(
                              goal,
                            );
                          }}
                          disabled={
                            mutating
                          }
                          style={({
                            pressed,
                          }) => [
                            styles.deleteGoalButton,
                            {
                              opacity:
                                mutating
                                  ? 0.4
                                  : pressed
                                    ? 0.55
                                    : 1,
                            },
                          ]}
                        >
                          <Text
                            style={
                              styles.deleteGoalText
                            }
                          >
                            Delete
                          </Text>
                        </Pressable>
                      </View>

                      {goal.type ===
                      'grade' ? (
                        <View
                          style={
                            styles.gradeProgressRow
                          }
                        >
                          <Text
                            style={
                              styles.gradeProgressLabel
                            }
                          >
                            Current
                          </Text>

                          <Text
                            style={
                              styles.gradeProgressValue
                            }
                          >
                            {
                              state.currentLabel
                            }
                          </Text>

                          <View
                            style={
                              styles.gradeProgressDivider
                            }
                          />

                          <Text
                            style={
                              styles.gradeProgressLabel
                            }
                          >
                            Target
                          </Text>

                          <Text
                            style={
                              styles.gradeProgressValue
                            }
                          >
                            {getGoalDisplay(
                              goal,
                            )}
                          </Text>
                        </View>
                      ) : (
                        <>
                          <View
                            style={
                              styles.progressTrack
                            }
                          >
                            <View
                              style={[
                                styles.progressFill,
                                {
                                  width:
                                    barWidth,
                                },
                              ]}
                            />
                          </View>

                          <View
                            style={
                              styles.progressFooter
                            }
                          >
                            <Text
                              style={
                                styles.goalProgress
                              }
                            >
                              {
                                state.currentLabel
                              }
                            </Text>

                            <Text
                              style={
                                styles.goalPercent
                              }
                            >
                              {
                                state.percent
                              }
                              %
                            </Text>
                          </View>
                        </>
                      )}
                    </View>
                  );
                },
              )}
            </View>
          )}

          {completedGoals.length >
          0 ? (
            <>
              <SectionHeader
                title="Completed"
                scheme={scheme}
              />

              <View
                style={
                  styles.goalList
                }
              >
                {completedGoals.map(
                  ({
                    goal,
                  }) => (
                    <View
                      key={
                        goal.id
                      }
                      style={
                        styles.completedGoalRow
                      }
                    >
                      <View
                        style={
                          styles.completedGoalMain
                        }
                      >
                        <Text
                          style={
                            styles.goalTitle
                          }
                        >
                          {
                            goal.title
                          }
                        </Text>

                        <Text
                          style={
                            styles.completedMeta
                          }
                        >
                          {getGoalDisplay(
                            goal,
                          )}
                          {goal.completedAt
                            ? ` · ${formatCompletionDate(
                                goal.completedAt,
                              )}`
                            : ''}
                        </Text>
                      </View>

                      <Text
                        style={
                          styles.completedStatus
                        }
                      >
                        Completed
                      </Text>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${goal.title}`}
                        onPress={() => {
                          void confirmDeleteGoal(
                            goal,
                          );
                        }}
                        disabled={
                          mutating
                        }
                        style={({
                          pressed,
                        }) => [
                          styles.deleteGoalButton,
                          {
                            opacity:
                              mutating
                                ? 0.4
                                : pressed
                                  ? 0.55
                                  : 1,
                          },
                        ]}
                      >
                        <Text
                          style={
                            styles.deleteGoalText
                          }
                        >
                          Delete
                        </Text>
                      </Pressable>
                    </View>
                  ),
                )}
              </View>
            </>
          ) : null}

          <SectionHeader
            title="Personal records"
            scheme={scheme}
          />

          <View
            style={
              styles.recordsList
            }
          >
            <RecordRow
              label="Highest grade"
              value={
                highestGrade ??
                '—'
              }
            />

            <RecordRow
              label="Hardest flash"
              value={
                hardestFlash
              }
            />

            <RecordRow
              label="Hardest send"
              value={
                hardestSend
              }
            />

            <RecordRow
              label="Most boulders in one session"
              value={
                mostProblemsSession
                  ? `${mostProblemsSession.boulders.length}`
                  : '—'
              }
            />

            <RecordRow
              label="Longest session"
              value={
                longestSession
                  ? formatSessionDuration(
                      longestSession,
                    )
                  : '—'
              }
            />

            <RecordRow
              label="Most attempts on one boulder"
              value={
                personalBoulders.length >
                0
                  ? `${mostAttemptsOnOneBoulder}`
                  : '—'
              }
            />

            <RecordRow
              label="Total attempts"
              value={`${totalAttempts}`}
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
      flexGrow: 1,
      backgroundColor:
        theme.background,
      paddingHorizontal:
        Layout.horizontalPadding,
      paddingTop:
        Spacing.lg,
      paddingBottom:
        Spacing.xxxl,
    },

    inner: {
      width: '100%',
      maxWidth:
        Layout.maxContentWidth,
      alignSelf: 'center',
    },

    header: {
      minHeight: 72,
      marginBottom:
        Spacing.md,
    },

    title: {
      color:
        theme.textPrimary,
      ...Typography.screenTitle,
    },

    subtitle: {
      color:
        theme.textMuted,
      ...Typography.body,
      marginTop:
        Spacing.xxs,
    },

    createSection: {
      gap: Spacing.md,
      paddingVertical:
        Spacing.lg,
      marginTop:
        Spacing.md,
      borderBottomWidth:
        Stroke.default,
      borderBottomColor:
        theme.border,
    },

    fieldGroup: {
      gap: Spacing.xs,
    },

    fieldLabel: {
      color:
        theme.textPrimary,
      ...Typography.bodyStrong,
    },

    fieldHint: {
      color:
        theme.textMuted,
      ...Typography.caption,
      maxWidth: 440,
    },

    input: {
      minHeight:
        Size.input,
      backgroundColor:
        theme.surface,
      borderWidth:
        Stroke.default,
      borderColor:
        theme.borderStrong,
      borderRadius:
        Radius.md,
      color:
        theme.textPrimary,
      paddingHorizontal:
        Spacing.md,
      ...Typography.body,
    },

    typeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },

    typeButton: {
      minHeight:
        Size.touchTarget,
      paddingHorizontal:
        Spacing.sm,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        theme.surface,
      borderWidth:
        Stroke.default,
      borderColor:
        theme.borderStrong,
      borderRadius:
        Radius.md,
    },

    typeButtonSelected: {
      backgroundColor:
        theme.action,
      borderColor:
        theme.action,
    },

    typeButtonText: {
      color:
        theme.textSecondary,
      ...Typography.bodyStrong,
      fontSize: 14,
    },

    typeButtonTextSelected: {
      color:
        theme.actionText,
    },

    loadingStack: {
      gap: Spacing.sm,
    },

    emptyState: {
      paddingVertical:
        Spacing.lg,
      borderTopWidth:
        Stroke.default,
      borderBottomWidth:
        Stroke.default,
      borderColor:
        theme.border,
    },

    emptyTitle: {
      color:
        theme.textPrimary,
      ...Typography.subheading,
    },

    emptyText: {
      color:
        theme.textMuted,
      ...Typography.body,
      marginTop:
        Spacing.xxs,
      maxWidth: 440,
    },

    goalList: {
      borderTopWidth:
        Stroke.default,
      borderTopColor:
        theme.border,
    },

    goalRow: {
      paddingVertical:
        Spacing.md,
      borderBottomWidth:
        Stroke.default,
      borderBottomColor:
        theme.border,
    },

    goalHeader: {
      flexDirection: 'row',
      alignItems:
        'flex-start',
      gap: Spacing.sm,
    },

    goalHeaderText: {
      flex: 1,
      minWidth: 0,
    },

    goalTitle: {
      color:
        theme.textPrimary,
      ...Typography.bodyStrong,
    },

    goalTarget: {
      color:
        theme.textMuted,
      ...Typography.caption,
      marginTop: 2,
    },

    deleteGoalButton: {
      minHeight:
        Size.touchTarget,
      justifyContent:
        'center',
      paddingHorizontal:
        Spacing.xs,
    },

    deleteGoalText: {
      color:
        theme.danger,
      ...Typography.caption,
    },

    gradeProgressRow: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop:
        Spacing.xs,
    },

    gradeProgressLabel: {
      color:
        theme.textMuted,
      ...Typography.caption,
    },

    gradeProgressValue: {
      color:
        theme.textPrimary,
      ...Typography.metric,
      fontFamily:
        Fonts.mono,
    },

    gradeProgressDivider: {
      flex: 1,
      height: 1,
      backgroundColor:
        theme.border,
      marginHorizontal:
        Spacing.xxs,
    },

    progressTrack: {
      height: 8,
      marginTop:
        Spacing.md,
      backgroundColor:
        theme.surfacePressed,
      borderRadius:
        Radius.pill,
      overflow: 'hidden',
    },

    progressFill: {
      height: '100%',
      backgroundColor:
        theme.action,
      borderRadius:
        Radius.pill,
    },

    progressFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginTop:
        Spacing.xs,
    },

    goalProgress: {
      color:
        theme.textSecondary,
      ...Typography.caption,
    },

    goalPercent: {
      color:
        theme.textPrimary,
      ...Typography.metric,
      fontFamily:
        Fonts.mono,
    },

    completedGoalRow: {
      minHeight: 66,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      borderBottomWidth:
        Stroke.default,
      borderBottomColor:
        theme.border,
    },

    completedGoalMain: {
      flex: 1,
      minWidth: 0,
    },

    completedMeta: {
      color:
        theme.textMuted,
      ...Typography.caption,
      marginTop: 2,
    },

    completedStatus: {
      color:
        theme.success,
      ...Typography.label,
      fontSize: 10,
    },

    recordsList: {
      borderTopWidth:
        Stroke.default,
      borderTopColor:
        theme.border,
    },

    recordRow: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      gap: Spacing.md,
      borderBottomWidth:
        Stroke.default,
      borderBottomColor:
        theme.border,
    },

    recordLabel: {
      flex: 1,
      color:
        theme.textSecondary,
      ...Typography.body,
    },

    recordValue: {
      color:
        theme.textPrimary,
      ...Typography.metric,
      fontFamily:
        Fonts.mono,
      textAlign: 'right',
    },
  });