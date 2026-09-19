import {
  router,
  useFocusEffect,
} from 'expo-router';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  GradeBadge,
} from '@/components/climbing/GradeBadge';
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
  DefaultCruxScheme,
  Fonts,
  Layout,
  Radius,
  Spacing,
  Stroke,
  Typography,
} from '@/constants/theme';

import {
  getHighestGrade,
  getSessions,
  gradeToNumber,
  type ClimbingSession,
} from '@/data/storage';

const scheme = DefaultCruxScheme;
const theme = CruxTheme[scheme];

function formatHeaderDate(): string {
  return new Date().toLocaleDateString(
    'en-GB',
    {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    },
  );
}

function formatSessionDate(
  dateString: string,
): string {
  return new Date(
    dateString,
  ).toLocaleDateString(
    'en-GB',
    {
      day: 'numeric',
      month: 'short',
    },
  );
}

function formatDuration(
  session: ClimbingSession,
): string {
  const start = new Date(
    session.startedAt,
  ).getTime();

  const end = session.finishedAt
    ? new Date(
        session.finishedAt,
      ).getTime()
    : Date.now();

  const totalMinutes = Math.max(
    0,
    Math.floor(
      (end - start) / 60000,
    ),
  );

  const hours = Math.floor(
    totalMinutes / 60,
  );

  const minutes =
    totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes
    .toString()
    .padStart(2, '0')}m`;
}

function getAttempts(
  session: ClimbingSession,
): number {
  return session.boulders.reduce(
    (total, boulder) =>
      total + boulder.attempts,
    0,
  );
}

function getSessionsBetween(
  sessions: ClimbingSession[],
  from: Date,
  to: Date,
): ClimbingSession[] {
  return sessions.filter(
    (session) => {
      if (!session.finishedAt) {
        return false;
      }

      const finishedAt =
        new Date(
          session.finishedAt,
        );

      return (
        finishedAt >= from &&
        finishedAt < to
      );
    },
  );
}

type FourWeekProgression = {
  current: string | null;
  previous: string | null;
  difference: number | null;
  currentSessions: number;
};

function getFourWeekProgression(
  sessions: ClimbingSession[],
): FourWeekProgression {
  const now = new Date();

  const fourWeeksAgo =
    new Date(now);

  fourWeeksAgo.setDate(
    now.getDate() - 28,
  );

  const eightWeeksAgo =
    new Date(now);

  eightWeeksAgo.setDate(
    now.getDate() - 56,
  );

  const currentSessions =
    getSessionsBetween(
      sessions,
      fourWeeksAgo,
      now,
    );

  const previousSessions =
    getSessionsBetween(
      sessions,
      eightWeeksAgo,
      fourWeeksAgo,
    );

  const current =
    getHighestGrade(
      currentSessions.flatMap(
        (session) =>
          session.boulders,
      ),
    );

  const previous =
    getHighestGrade(
      previousSessions.flatMap(
        (session) =>
          session.boulders,
      ),
    );

  return {
    current,
    previous,
    difference:
      current !== null &&
      previous !== null
        ? gradeToNumber(
            current,
          ) -
          gradeToNumber(
            previous,
          )
        : null,
    currentSessions:
      currentSessions.length,
  };
}

function getProgressionSummary(
  progression: FourWeekProgression,
): string {
  if (
    progression.difference === null
  ) {
    return 'More completed sessions are needed for a comparison.';
  }

  if (
    progression.difference > 0
  ) {
    return `Best grade is up ${
      progression.difference
    } ${
      progression.difference === 1
        ? 'step'
        : 'steps'
    } from the previous four weeks.`;
  }

  if (
    progression.difference === 0
  ) {
    return 'Best grade is unchanged from the previous four weeks.';
  }

  return 'Best grade is lower than the previous four weeks.';
}

function HomeLoading() {
  return (
    <View
      style={
        styles.loadingGroup
      }
    >
      <Skeleton
        scheme={scheme}
        height={96}
        radius="lg"
      />

      <Skeleton
        scheme={scheme}
        height={64}
      />

      <Skeleton
        scheme={scheme}
        height={64}
      />

      <Skeleton
        scheme={scheme}
        height={112}
      />
    </View>
  );
}

function ActiveSessionCard({
  session,
}: {
  session: ClimbingSession;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Resume session at ${session.gymName}`}
      onPress={() =>
        router.push('/session')
      }
      style={({ pressed }) => [
        styles.activeCard,
        {
          backgroundColor:
            pressed
              ? theme.surfacePressed
              : theme.surface,
        },
      ]}
    >
      <View
        style={
          styles.activeTopRow
        }
      >
        <View
          style={
            styles.activeContent
          }
        >
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={
              styles.activeGym
            }
          >
            {session.gymName}
          </Text>

          <Text
            numberOfLines={1}
            style={
              styles.activeMeta
            }
          >
            {formatDuration(
              session,
            )}
            {' · '}
            {session.boulders.length}{' '}
            boulders
            {' · '}
            {getAttempts(
              session,
            )}{' '}
            attempts
          </Text>
        </View>

        <View
          style={
            styles.activeStatus
          }
        >
          <Text
            style={
              styles.activeStatusText
            }
          >
            Active
          </Text>
        </View>
      </View>

      <Text
        style={
          styles.resumeText
        }
      >
        Resume session
      </Text>
    </Pressable>
  );
}

function RecentSessionRow({
  session,
}: {
  session: ClimbingSession;
}) {
  const highest =
    getHighestGrade(
      session.boulders,
    );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${session.gymName} session`}
      onPress={() =>
        router.push({
          pathname:
            '/session-details',
          params: {
            sessionId:
              session.id,
          },
        })
      }
      style={({ pressed }) => [
        styles.sessionRow,
        {
          backgroundColor:
            pressed
              ? theme.surfacePressed
              : 'transparent',
        },
      ]}
    >
      <View
        style={
          styles.dateColumn
        }
      >
        <Text
          numberOfLines={1}
          style={
            styles.dateText
          }
        >
          {formatSessionDate(
            session.finishedAt ??
              session.startedAt,
          )}
        </Text>
      </View>

      <View
        style={
          styles.sessionContent
        }
      >
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={
            styles.sessionGym
          }
        >
          {session.gymName}
        </Text>

        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={
            styles.sessionMeta
          }
        >
          {session.boulders.length}{' '}
          boulders
          {' · '}
          {getAttempts(
            session,
          )}{' '}
          attempts
          {' · '}
          {formatDuration(
            session,
          )}
        </Text>
      </View>

      <GradeBadge
        grade={
          highest ?? '—'
        }
        scheme={scheme}
      />
    </Pressable>
  );
}

function ProgressMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View
      style={
        styles.progressMetric
      }
    >
      <Text
        style={
          styles.progressMetricLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.progressMetricValue
        }
      >
        {value}
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const [
    sessions,
    setSessions,
  ] =
    useState<
      ClimbingSession[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    loadError,
    setLoadError,
  ] =
    useState<string | null>(
      null,
    );

  const hasLoadedRef =
    useRef(false);

  const loadDashboard =
    useCallback(
      async () => {
        if (
          !hasLoadedRef.current
        ) {
          setLoading(true);
        }

        setLoadError(null);

        try {
          const saved =
            await getSessions();

          setSessions(saved);
        } catch (error) {
          console.error(
            'Failed to load home:',
            error,
          );

          setLoadError(
            'CRUX could not load your climbing data.',
          );
        } finally {
          hasLoadedRef.current =
            true;

          setLoading(false);
        }
      },
      [],
    );

  useFocusEffect(
    useCallback(
      () => {
        void loadDashboard();
      },
      [loadDashboard],
    ),
  );

  const activeSession =
    useMemo(
      () =>
        sessions.find(
          (session) =>
            !session.finishedAt,
        ) ?? null,
      [sessions],
    );

  const finishedSessions =
    useMemo(
      () =>
        sessions
          .filter(
            (session) =>
              Boolean(
                session.finishedAt,
              ),
          )
          .sort(
            (a, b) =>
              new Date(
                b.finishedAt!,
              ).getTime() -
              new Date(
                a.finishedAt!,
              ).getTime(),
          ),
      [sessions],
    );

  const recentSessions =
    finishedSessions.slice(
      0,
      3,
    );

  const progression =
    useMemo(
      () =>
        getFourWeekProgression(
          finishedSessions,
        ),
      [finishedSessions],
    );

  const progressionSummary =
    getProgressionSummary(
      progression,
    );

  return (
    <SafeAreaView
      edges={['top']}
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
            <View
              style={
                styles.brandBlock
              }
            >
              <Text
                style={
                  styles.wordmark
                }
              >
                CRUX
              </Text>

              <Text
                style={
                  styles.productLabel
                }
              >
                Climbing log
              </Text>
            </View>

            <Text
              style={
                styles.headerDate
              }
            >
              {formatHeaderDate()}
            </Text>
          </View>

          {loading ? (
            <HomeLoading />
          ) : loadError ? (
            <View
              style={
                styles.errorState
              }
            >
              <Text
                style={
                  styles.errorTitle
                }
              >
                Couldn’t load climbing data
              </Text>

              <Text
                style={
                  styles.errorText
                }
              >
                {loadError}
              </Text>

              <View
                style={
                  styles.errorAction
                }
              >
                <AppButton
                  label="Try again"
                  variant="secondary"
                  compact
                  scheme={scheme}
                  onPress={() => {
                    void loadDashboard();
                  }}
                />
              </View>
            </View>
          ) : (
            <>
              <SectionHeader
                title={
                  activeSession
                    ? 'Active session'
                    : 'Start climbing'
                }
                scheme={scheme}
              />

              {activeSession ? (
                <ActiveSessionCard
                  session={
                    activeSession
                  }
                />
              ) : (
                <View
                  style={
                    styles.startBlock
                  }
                >
                  <Text
                    style={
                      styles.startTitle
                    }
                  >
                    Ready for your next session
                  </Text>

                  <Text
                    style={
                      styles.startDescription
                    }
                  >
                    Log grades, attempts and results while you climb.
                  </Text>

                  <View
                    style={
                      styles.primaryAction
                    }
                  >
                    <AppButton
                      label="Start session"
                      scheme={scheme}
                      onPress={() =>
                        router.push(
                          '/session',
                        )
                      }
                    />
                  </View>
                </View>
              )}

              <SectionHeader
                title="Recent sessions"
                actionLabel="See all"
                scheme={scheme}
                onActionPress={() =>
                  router.push(
                    '/history',
                  )
                }
              />

              {recentSessions.length >
              0 ? (
                <View
                  style={
                    styles.sessionList
                  }
                >
                  {recentSessions.map(
                    (session) => (
                      <RecentSessionRow
                        key={
                          session.id
                        }
                        session={
                          session
                        }
                      />
                    ),
                  )}
                </View>
              ) : (
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
                    No completed sessions
                  </Text>

                  <Text
                    style={
                      styles.emptyText
                    }
                  >
                    Finished sessions will appear here with their duration, attempts and highest achieved grade.
                  </Text>
                </View>
              )}

              <SectionHeader
                title="Four-week progression"
                scheme={scheme}
              />

              <View
                style={
                  styles.progressSection
                }
              >
                <View
                  style={
                    styles.progressComparison
                  }
                >
                  <ProgressMetric
                    label="Current best"
                    value={
                      progression.current ??
                      '—'
                    }
                  />

                  <View
                    style={
                      styles.progressDivider
                    }
                  />

                  <ProgressMetric
                    label="Previous best"
                    value={
                      progression.previous ??
                      '—'
                    }
                  />
                </View>

                <View
                  style={
                    styles.progressDetailRow
                  }
                >
                  <Text
                    style={
                      styles.progressSessionsLabel
                    }
                  >
                    Sessions in last 4 weeks
                  </Text>

                  <Text
                    style={
                      styles.progressSessionsValue
                    }
                  >
                    {
                      progression.currentSessions
                    }
                  </Text>
                </View>

                <Text
                  style={
                    styles.progressSummary
                  }
                >
                  {progressionSummary}
                </Text>
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
      minHeight: 68,
      flexDirection: 'row',
      alignItems:
        'flex-start',
      justifyContent:
        'space-between',
      gap: Spacing.md,
      paddingTop:
        Spacing.xs,
      marginBottom:
        Spacing.sm,
    },

    brandBlock: {
      flex: 1,
      minWidth: 0,
    },

    wordmark: {
      color:
        theme.textPrimary,
      fontSize: 27,
      lineHeight: 31,
      fontWeight: '800',
      letterSpacing: 1.1,
    },

    productLabel: {
      color:
        theme.textMuted,
      ...Typography.caption,
      marginTop:
        Spacing.xxs,
    },

    headerDate: {
      color:
        theme.textMuted,
      ...Typography.caption,
      marginTop:
        Spacing.xxs,
    },

    loadingGroup: {
      gap: Spacing.sm,
      marginTop:
        Spacing.md,
    },

    startBlock: {
      paddingTop:
        Spacing.xxs,
      paddingBottom:
        Spacing.md,
    },

    startTitle: {
      color:
        theme.textPrimary,
      ...Typography.heading,
    },

    startDescription: {
      color:
        theme.textSecondary,
      ...Typography.body,
      maxWidth: 420,
      marginTop:
        Spacing.xxs,
    },

    primaryAction: {
      marginTop:
        Spacing.md,
      maxWidth: 360,
    },

    activeCard: {
      backgroundColor:
        theme.surface,
      borderWidth:
        Stroke.default,
      borderColor:
        theme.border,
      borderRadius:
        Radius.lg,
      padding:
        Spacing.md,
      marginTop:
        Spacing.xxs,
    },

    activeTopRow: {
      flexDirection: 'row',
      alignItems:
        'flex-start',
      gap: Spacing.md,
    },

    activeContent: {
      flex: 1,
      minWidth: 0,
    },

    activeGym: {
      color:
        theme.textPrimary,
      ...Typography.heading,
    },

    activeMeta: {
      color:
        theme.textMuted,
      ...Typography.caption,
      marginTop:
        Spacing.xxs,
    },

    activeStatus: {
      minHeight: 28,
      justifyContent:
        'center',
      backgroundColor:
        theme.successSurface,
      borderRadius:
        Radius.pill,
      paddingHorizontal:
        Spacing.sm,
    },

    activeStatusText: {
      color:
        theme.success,
      ...Typography.label,
      fontSize: 11,
    },

    resumeText: {
      color:
        theme.action,
      ...Typography.bodyStrong,
      marginTop:
        Spacing.md,
      paddingTop:
        Spacing.sm,
      borderTopWidth:
        Stroke.default,
      borderTopColor:
        theme.border,
    },

    sessionList: {
      borderTopWidth:
        Stroke.default,
      borderTopColor:
        theme.border,
    },

    sessionRow: {
      minHeight: 68,
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

    dateColumn: {
      width: 52,
      flexShrink: 0,
    },

    dateText: {
      color:
        theme.textMuted,
      ...Typography.caption,
      fontVariant: [
        'tabular-nums',
      ],
    },

    sessionContent: {
      flex: 1,
      minWidth: 0,
    },

    sessionGym: {
      color:
        theme.textPrimary,
      ...Typography.bodyStrong,
    },

    sessionMeta: {
      color:
        theme.textMuted,
      ...Typography.caption,
      marginTop:
        Spacing.xxs,
    },

    emptyState: {
      borderTopWidth:
        Stroke.default,
      borderBottomWidth:
        Stroke.default,
      borderColor:
        theme.border,
      paddingVertical:
        Spacing.lg,
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
      maxWidth: 430,
      marginTop:
        Spacing.xxs,
    },

    progressSection: {
      borderTopWidth:
        Stroke.default,
      borderBottomWidth:
        Stroke.default,
      borderColor:
        theme.border,
    },

    progressComparison: {
      flexDirection: 'row',
      paddingVertical:
        Spacing.md,
    },

    progressMetric: {
      flex: 1,
      minWidth: 0,
    },

    progressMetricLabel: {
      color:
        theme.textMuted,
      ...Typography.caption,
    },

    progressMetricValue: {
      color:
        theme.textPrimary,
      ...Typography.metricLarge,
      fontFamily:
        Fonts.mono,
      marginTop:
        Spacing.xxs,
    },

    progressDivider: {
      width:
        Stroke.default,
      backgroundColor:
        theme.border,
      marginHorizontal:
        Spacing.md,
    },

    progressDetailRow: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      gap: Spacing.md,
      borderTopWidth:
        Stroke.default,
      borderTopColor:
        theme.border,
    },

    progressSessionsLabel: {
      color:
        theme.textSecondary,
      ...Typography.body,
    },

    progressSessionsValue: {
      color:
        theme.textPrimary,
      ...Typography.metric,
      fontFamily:
        Fonts.mono,
    },

    progressSummary: {
      color:
        theme.textMuted,
      ...Typography.caption,
      borderTopWidth:
        Stroke.default,
      borderTopColor:
        theme.border,
      paddingVertical:
        Spacing.sm,
    },

    errorState: {
      borderTopWidth:
        Stroke.default,
      borderBottomWidth:
        Stroke.default,
      borderColor:
        theme.border,
      paddingVertical:
        Spacing.lg,
      marginTop:
        Spacing.md,
    },

    errorTitle: {
      color:
        theme.textPrimary,
      ...Typography.heading,
    },

    errorText: {
      color:
        theme.textSecondary,
      ...Typography.body,
      marginTop:
        Spacing.xxs,
    },

    errorAction: {
      maxWidth: 180,
      marginTop:
        Spacing.md,
    },
  });