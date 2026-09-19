import { SafeAreaView } from 'react-native-safe-area-context';
import {
  router,
  useFocusEffect,
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
  GradeBadge,
} from '@/components/climbing/GradeBadge';
import {
  AppButton,
} from '@/components/core/AppButton';

import {
  CruxTheme,
  DefaultCruxScheme,
  Fonts,
  Layout,
  Radius,
  Size,
  Spacing,
  Stroke,
  Typography,
} from '@/constants/theme';

import {
  createSession,
  finishSession,
  getSessions,
  type Boulder,
  type ClimbingSession,
} from '@/data/storage';

import {
  confirmAction,
  showMessage,
} from '@/utils/dialogs';

const scheme =
  DefaultCruxScheme;

const theme =
  CruxTheme[scheme];

function formatDuration(
  totalSeconds: number,
): string {
  const hours = Math.floor(
    totalSeconds / 3600,
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) /
      60,
  );

  const seconds =
    totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }

  return `${minutes}:${seconds
    .toString()
    .padStart(2, '0')}`;
}

function formatChoices(
  value: string | string[] | undefined,
): string {
  if (!value) return '—';
  return Array.isArray(value)
    ? value.join(' · ')
    : value;
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View
      style={
        styles.metric
      }
    >
      <Text
        style={
          styles.metricValue
        }
      >
        {value}
      </Text>

      <Text
        style={
          styles.metricLabel
        }
      >
        {label}
      </Text>
    </View>
  );
}

export default function SessionScreen() {
  const [
    gymName,
    setGymName,
  ] = useState('');

  const [
    session,
    setSession,
  ] =
    useState<ClimbingSession | null>(
      null,
    );

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    elapsedSeconds,
    setElapsedSeconds,
  ] = useState(0);

  const activeSessionId =
    session?.id ?? null;

  const loadOrRefreshSession =
    useCallback(async () => {
      try {
        const sessions =
          await getSessions();

        const currentSession =
          activeSessionId
            ? sessions.find(
                (item) =>
                  item.id ===
                    activeSessionId &&
                  !item.finishedAt,
              )
            : undefined;

        const unfinishedSession =
          currentSession ??
          sessions
            .filter(
              (item) =>
                !item.finishedAt,
            )
            .sort(
              (a, b) =>
                new Date(
                  b.startedAt,
                ).getTime() -
                new Date(
                  a.startedAt,
                ).getTime(),
            )[0];

        if (unfinishedSession) {
          setSession(
            unfinishedSession,
          );

          setGymName(
            unfinishedSession.gymName,
          );

          return;
        }

        if (activeSessionId) {
          setSession(null);
          setGymName('');
          setElapsedSeconds(0);
        }
      } catch (error) {
        console.error(
          'Load session error:',
          error,
        );
      }
    }, [activeSessionId]);

  useFocusEffect(
    useCallback(() => {
      void loadOrRefreshSession();
    }, [loadOrRefreshSession]),
  );

  useEffect(() => {
    if (!session) {
      setElapsedSeconds(0);
      return;
    }

    const updateTimer = () => {
      const startTime =
        new Date(
          session.startedAt,
        ).getTime();

      const endTime =
        session.finishedAt
          ? new Date(
              session.finishedAt,
            ).getTime()
          : Date.now();

      const difference =
        Math.max(
          0,
          Math.floor(
            (endTime -
              startTime) /
              1000,
          ),
        );

      setElapsedSeconds(
        difference,
      );
    };

    updateTimer();

    const interval =
      setInterval(
        updateTimer,
        1000,
      );

    return () =>
      clearInterval(
        interval,
      );
  }, [session]);

  const startSession =
    async () => {
      if (saving) {
        return;
      }

      if (!gymName.trim()) {
        showMessage(
          'Gym name required',
          'Enter the name of the gym before starting your session.',
        );

        return;
      }

      try {
        setSaving(true);

        const newSession =
          await createSession(
            gymName,
          );

        setSession(
          newSession,
        );

        setGymName(
          newSession.gymName,
        );

        setElapsedSeconds(0);
      } catch (error) {
        console.error(
          'Start session error:',
          error,
        );

        showMessage(
          'Could not start session',
          'Something went wrong while saving the session.',
        );
      } finally {
        setSaving(false);
      }
    };

  const openAddBoulder = () => {
    if (!session) {
      showMessage(
        'Start your session first',
        'Enter your gym name and start the session.',
      );

      return;
    }

    router.push({
      pathname:
        '/add-boulder',
      params: {
        sessionId:
          session.id,
      },
    });
  };

  const openEditBoulder = (
    boulderId: string,
  ) => {
    if (!session) {
      return;
    }

    router.push({
      pathname:
        '/edit-boulder',
      params: {
        sessionId:
          session.id,
        boulderId,
      },
    });
  };

  const finishTheSession =
    async () => {
      if (
        saving ||
        !session
      ) {
        return;
      }

      try {
        setSaving(true);

        await finishSession(
          session.id,
        );

        setSession(null);
        setGymName('');
        setElapsedSeconds(0);

        router.back();
      } catch (error) {
        console.error(
          'Finish session error:',
          error,
        );

        showMessage(
          'Could not finish session',
          'Something went wrong while saving the session.',
        );
      } finally {
        setSaving(false);
      }
    };

  const finishCurrentSession =
    async () => {
      if (!session) {
        router.back();
        return;
      }

      const confirmed =
        await confirmAction({
          title:
            'Finish session?',
          message:
            'This will save your session and stop the timer.',
          confirmText:
            'Finish',
          cancelText:
            'Keep climbing',
        });

      if (!confirmed) {
        return;
      }

      await finishTheSession();
    };

  const boulders: Boulder[] =
    session?.boulders ?? [];

  const flashes =
    boulders.filter(
      (boulder) =>
        boulder.result ===
        'Flash',
    ).length;

  const sends =
    boulders.filter(
      (boulder) =>
        boulder.result ===
        'Send',
    ).length;

  const attempts =
    boulders.reduce(
      (
        total,
        boulder,
      ) =>
        total +
        boulder.attempts,
      0,
    );

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
                    pressed
                      ? 0.55
                      : saving
                        ? 0.4
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
                {session
                  ? session.gymName
                  : 'New session'}
              </Text>

              <Text
                style={
                  styles.subtitle
                }
              >
                {session
                  ? 'Session in progress'
                  : 'Start a climbing session'}
              </Text>
            </View>
          </View>

          {!session ? (
            <>
              <Text
                style={
                  styles.fieldLabel
                }
              >
                Gym
              </Text>

              <TextInput
                value={gymName}
                onChangeText={
                  setGymName
                }
                placeholder="Enter gym name"
                placeholderTextColor={
                  theme.textMuted
                }
                style={
                  styles.input
                }
                autoCapitalize="words"
                editable={!saving}
                returnKeyType="done"
                onSubmitEditing={() => {
                  void startSession();
                }}
              />

              <View
                style={
                  styles.startAction
                }
              >
                <AppButton
                  label="Start session"
                  loading={saving}
                  disabled={
                    !gymName.trim()
                  }
                  scheme={scheme}
                  onPress={() => {
                    void startSession();
                  }}
                />
              </View>
            </>
          ) : (
            <>
              <View
                style={
                  styles.timerSection
                }
              >
                <Text
                  style={
                    styles.timerLabel
                  }
                >
                  Elapsed
                </Text>

                <Text
                  style={
                    styles.timerValue
                  }
                >
                  {formatDuration(
                    elapsedSeconds,
                  )}
                </Text>
              </View>

              <View
                style={
                  styles.metrics
                }
              >
                <Metric
                  label="Boulders"
                  value={
                    boulders.length
                  }
                />

                <View
                  style={
                    styles.metricDivider
                  }
                />

                <Metric
                  label="Flashes"
                  value={flashes}
                />

                <View
                  style={
                    styles.metricDivider
                  }
                />

                <Metric
                  label="Sends"
                  value={sends}
                />

                <View
                  style={
                    styles.metricDivider
                  }
                />

                <Metric
                  label="Attempts"
                  value={attempts}
                />
              </View>

              <View
                style={
                  styles.sectionHeader
                }
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Climbs
                </Text>

                <Text
                  style={
                    styles.sectionCount
                  }
                >
                  {boulders.length}
                </Text>
              </View>

              {boulders.length ===
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
                    No boulders logged
                  </Text>

                  <Text
                    style={
                      styles.emptyText
                    }
                  >
                    Add a boulder when you are ready to log your first climb.
                  </Text>
                </View>
              ) : (
                <View
                  style={
                    styles.climbList
                  }
                >
                  {boulders.map(
                    (
                      boulder,
                    ) => (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${boulder.name ?? boulder.grade}`}
                        key={
                          boulder.id
                        }
                        onPress={() =>
                          openEditBoulder(
                            boulder.id,
                          )
                        }
                        style={({
                          pressed,
                        }) => [
                          styles.climbRow,
                          {
                            backgroundColor:
                              pressed
                                ? theme.surfacePressed
                                : 'transparent',
                          },
                        ]}
                      >
                        <GradeBadge
                          grade={
                            boulder.grade
                          }
                          scheme={scheme}
                        />

                        <View
                          style={
                            styles.climbDetails
                          }
                        >
                          <Text
                            numberOfLines={
                              1
                            }
                            style={
                              styles.climbName
                            }
                          >
                            {boulder.name ??
                              boulder.result}
                          </Text>

                          <Text
                            numberOfLines={
                              1
                            }
                            style={
                              styles.climbMeta
                            }
                          >
                            {boulder.name
                              ? `${boulder.result} · `
                              : ''}
                            {formatChoices(
                              boulder.holdType,
                            )}
                          </Text>

                          <Text
                            numberOfLines={
                              1
                            }
                            style={
                              styles.climbSecondary
                            }
                          >
                            {formatChoices(
                              boulder.movementType,
                            )}
                          </Text>
                        </View>

                        <View
                          style={
                            styles.attemptColumn
                          }
                        >
                          <Text
                            style={
                              styles.attemptValue
                            }
                          >
                            {
                              boulder.attempts
                            }
                          </Text>

                          <Text
                            style={
                              styles.attemptLabel
                            }
                          >
                            {boulder.attempts ===
                            1
                              ? 'attempt'
                              : 'attempts'}
                          </Text>
                        </View>
                      </Pressable>
                    ),
                  )}
                </View>
              )}

              <View
                style={
                  styles.actions
                }
              >
                <AppButton
                  label="Add boulder"
                  disabled={saving}
                  scheme={scheme}
                  onPress={
                    openAddBoulder
                  }
                />

                <AppButton
                  label="Finish session"
                  variant="secondary"
                  loading={saving}
                  scheme={scheme}
                  onPress={() => {
                    void finishCurrentSession();
                  }}
                />
              </View>
            </>
          )}
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

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      minHeight: 60,
      marginBottom:
        Spacing.xl,
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
      minWidth: 0,
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

    fieldLabel: {
      color:
        theme.textSecondary,
      ...Typography.bodyStrong,
      marginBottom:
        Spacing.xs,
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

    startAction: {
      marginTop:
        Spacing.md,
    },

    timerSection: {
      alignItems: 'center',
      paddingVertical:
        Spacing.lg,
      borderTopWidth:
        Stroke.default,
      borderBottomWidth:
        Stroke.default,
      borderColor:
        theme.border,
    },

    timerLabel: {
      color:
        theme.textMuted,
      ...Typography.caption,
      marginBottom:
        Spacing.xs,
    },

    timerValue: {
      color:
        theme.textPrimary,
      ...Typography.timer,
      fontFamily:
        Fonts.mono,
    },

    metrics: {
      minHeight: 78,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth:
        Stroke.default,
      borderBottomColor:
        theme.border,
    },

    metric: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal:
        Spacing.xxs,
    },

    metricValue: {
      color:
        theme.textPrimary,
      ...Typography.metricLarge,
      fontFamily:
        Fonts.mono,
    },

    metricLabel: {
      color:
        theme.textMuted,
      ...Typography.caption,
      fontSize: 11,
      marginTop: 2,
    },

    metricDivider: {
      width: 1,
      height: 30,
      backgroundColor:
        theme.border,
    },

    sectionHeader: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginTop:
        Spacing.lg,
    },

    sectionTitle: {
      color:
        theme.textPrimary,
      ...Typography.subheading,
    },

    sectionCount: {
      color:
        theme.textMuted,
      ...Typography.metric,
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
      maxWidth: 420,
    },

    climbList: {
      borderTopWidth:
        Stroke.default,
      borderTopColor:
        theme.border,
    },

    climbRow: {
      minHeight: 76,
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
      marginHorizontal:
        -Spacing.xxs,
    },

    climbDetails: {
      flex: 1,
      minWidth: 0,
    },

    climbName: {
      color:
        theme.textPrimary,
      ...Typography.bodyStrong,
    },

    climbMeta: {
      color:
        theme.textSecondary,
      ...Typography.caption,
      marginTop: 2,
    },

    climbSecondary: {
      color:
        theme.textMuted,
      ...Typography.caption,
      marginTop: 1,
    },

    attemptColumn: {
      alignItems:
        'flex-end',
      minWidth: 58,
    },

    attemptValue: {
      color:
        theme.textPrimary,
      ...Typography.metric,
      fontFamily:
        Fonts.mono,
    },

    attemptLabel: {
      color:
        theme.textMuted,
      ...Typography.caption,
      fontSize: 10,
    },

    actions: {
      gap: Spacing.sm,
      marginTop:
        Spacing.xl,
    },
  });