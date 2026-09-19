import {
  useFocusEffect,
} from 'expo-router';
import {
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  GradeBadge,
} from '@/components/climbing/GradeBadge';
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
  calculateClimbingStats,
  getHighestGrade,
  getSessions,
  gradeToNumber,
  type ClimbingSession,
} from '@/data/storage';

const scheme =
  DefaultCruxScheme;

const theme =
  CruxTheme.light;

type GradeCount = {
  grade: string;
  count: number;
};

function isThisWeek(
  dateString: string,
): boolean {
  const date =
    new Date(dateString);

  const now =
    new Date();

  const currentDay =
    now.getDay();

  const daysSinceMonday =
    currentDay === 0
      ? 6
      : currentDay - 1;

  const startOfWeek =
    new Date(now);

  startOfWeek.setHours(
    0,
    0,
    0,
    0,
  );

  startOfWeek.setDate(
    now.getDate() -
      daysSinceMonday,
  );

  return (
    date >= startOfWeek &&
    date <= now
  );
}

function formatDuration(
  startedAt: string,
  finishedAt?: string,
): string {
  if (!finishedAt) {
    return 'In progress';
  }

  const difference =
    new Date(
      finishedAt,
    ).getTime() -
    new Date(
      startedAt,
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

function getGradeCounts(
  sessions: ClimbingSession[],
): GradeCount[] {
  const counts =
    new Map<string, number>();

  sessions.forEach(
    (session) => {
      session.boulders.forEach(
        (boulder) => {
          counts.set(
            boulder.grade,
            (counts.get(
              boulder.grade,
            ) ?? 0) + 1,
          );
        },
      );
    },
  );

  return [
    ...counts.entries(),
  ]
    .map(
      ([
        grade,
        count,
      ]) => ({
        grade,
        count,
      }),
    )
    .sort(
      (a, b) =>
        gradeToNumber(
          a.grade,
        ) -
        gradeToNumber(
          b.grade,
        ),
    );
}

function PrimaryMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View
      style={
        styles.primaryMetric
      }
    >
      <Text
        style={
          styles.primaryMetricValue
        }
      >
        {value}
      </Text>

      <Text
        style={
          styles.primaryMetricLabel
        }
      >
        {label}
      </Text>
    </View>
  );
}

function DataRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string | number;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.dataRow,
        last &&
          styles.dataRowLast,
      ]}
    >
      <Text
        style={
          styles.dataRowLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.dataRowValue
        }
      >
        {value}
      </Text>
    </View>
  );
}

export default function StatsScreen() {
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
    useState<
      string | null
    >(null);

  const loadStats =
    useCallback(
      async () => {
        try {
          setLoadError(null);

          const savedSessions =
            await getSessions();

          setSessions(
            savedSessions,
          );
        } catch (error) {
          console.error(
            'Failed to load statistics:',
            error,
          );

          setLoadError(
            'CRUX could not load your climbing statistics.',
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  useFocusEffect(
    useCallback(() => {
      void loadStats();
    }, [loadStats]),
  );

  const finishedSessions =
    useMemo(
      () =>
        sessions.filter(
          (session) =>
            Boolean(
              session.finishedAt,
            ),
        ),
      [sessions],
    );

  const allBoulders =
    useMemo(
      () =>
        finishedSessions.flatMap(
          (session) =>
            session.boulders,
        ),
      [finishedSessions],
    );

  const weeklySessions =
    useMemo(
      () =>
        finishedSessions.filter(
          (session) =>
            isThisWeek(
              session.finishedAt!,
            ),
        ),
      [finishedSessions],
    );

  const weeklyBoulders =
    useMemo(
      () =>
        weeklySessions.reduce(
          (
            total,
            session,
          ) =>
            total +
            session.boulders.length,
          0,
        ),
      [weeklySessions],
    );

  const weeklyAttempts =
    useMemo(
      () =>
        weeklySessions.reduce(
          (
            total,
            session,
          ) =>
            total +
            session.boulders.reduce(
              (
                sessionTotal,
                boulder,
              ) =>
                sessionTotal +
                boulder.attempts,
              0,
            ),
          0,
        ),
      [weeklySessions],
    );

  const stats =
    useMemo(
      () =>
        calculateClimbingStats(
          finishedSessions,
        ),
      [finishedSessions],
    );

  const gradeCounts =
    useMemo(
      () =>
        getGradeCounts(
          finishedSessions,
        ),
      [finishedSessions],
    );

  const maxGradeCount =
    Math.max(
      1,
      ...gradeCounts.map(
        (item) =>
          item.count,
      ),
    );

  const recentSessions =
    useMemo(
      () =>
        [
          ...finishedSessions,
        ]
          .sort(
            (a, b) =>
              new Date(
                b.finishedAt!,
              ).getTime() -
              new Date(
                a.finishedAt!,
              ).getTime(),
          )
          .slice(0, 6),
      [finishedSessions],
    );

  const flashRate =
    Math.round(
      stats.flashRate,
    );

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
    >
      <ScrollView
        style={
          styles.scrollView
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
            <Text
              style={
                styles.title
              }
            >
              Stats
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              Performance across your completed sessions
            </Text>
          </View>

          {loading ? (
            <View
              style={
                styles.loadingStack
              }
            >
              <Skeleton
                scheme={scheme}
                height={126}
              />

              <Skeleton
                scheme={scheme}
                height={82}
              />

              <Skeleton
                scheme={scheme}
                height={180}
              />
            </View>
          ) : loadError ? (
            <View
              style={
                styles.stateBlock
              }
            >
              <Text
                style={
                  styles.stateTitle
                }
              >
                Couldn’t load stats
              </Text>

              <Text
                style={
                  styles.stateText
                }
              >
                {loadError}
              </Text>
            </View>
          ) : finishedSessions.length ===
            0 ? (
            <View
              style={
                styles.stateBlock
              }
            >
              <Text
                style={
                  styles.stateTitle
                }
              >
                No climbing data yet
              </Text>

              <Text
                style={
                  styles.stateText
                }
              >
                Complete your first session and your performance data will appear here.
              </Text>
            </View>
          ) : (
            <>
              <View
                style={
                  styles.performanceHeader
                }
              >
                <View
                  style={
                    styles.bestGradeBlock
                  }
                >
                  <Text
                    style={
                      styles.bestGradeLabel
                    }
                  >
                    Hardest achieved
                  </Text>

                  <Text
                    style={
                      styles.bestGrade
                    }
                  >
                    {stats.highestGrade ??
                      '—'}
                  </Text>
                </View>

                <View
                  style={
                    styles.performanceSummary
                  }
                >
                  <DataRow
                    label="Sessions"
                    value={
                      finishedSessions.length
                    }
                  />

                  <DataRow
                    label="Boulders"
                    value={
                      allBoulders.length
                    }
                  />

                  <DataRow
                    label="Attempts"
                    value={
                      stats.attempts
                    }
                    last
                  />
                </View>
              </View>

              <SectionHeader
                title="This week"
                scheme={scheme}
              />

              <View
                style={
                  styles.weekStrip
                }
              >
                <PrimaryMetric
                  label="Sessions"
                  value={
                    weeklySessions.length
                  }
                />

                <View
                  style={
                    styles.verticalDivider
                  }
                />

                <PrimaryMetric
                  label="Boulders"
                  value={
                    weeklyBoulders
                  }
                />

                <View
                  style={
                    styles.verticalDivider
                  }
                />

                <PrimaryMetric
                  label="Attempts"
                  value={
                    weeklyAttempts
                  }
                />
              </View>

              <SectionHeader
                title="Results"
                scheme={scheme}
              />

              <View
                style={
                  styles.resultTable
                }
              >
                <DataRow
                  label="Flashes"
                  value={
                    stats.flashes
                  }
                />

                <DataRow
                  label="Sends"
                  value={
                    stats.sends
                  }
                />

                <DataRow
                  label="Completed climbs"
                  value={
                    stats.completed
                  }
                />

                <DataRow
                  label="Project entries"
                  value={
                    stats.projects
                  }
                />

                <DataRow
                  label="Flash rate"
                  value={`${flashRate}%`}
                  last
                />
              </View>

              <SectionHeader
                title="Grade distribution"
                scheme={scheme}
              />

              <View
                style={
                  styles.gradeChart
                }
              >
                {gradeCounts.map(
                  (item) => {
                    const percentage =
                      Math.max(
                        6,
                        (item.count /
                          maxGradeCount) *
                          100,
                      );

                    const width =
                      `${percentage}%` as `${number}%`;

                    return (
                      <View
                        key={
                          item.grade
                        }
                        style={
                          styles.gradeRow
                        }
                      >
                        <Text
                          style={
                            styles.gradeLabel
                          }
                        >
                          {
                            item.grade
                          }
                        </Text>

                        <View
                          style={
                            styles.gradeTrack
                          }
                        >
                          <View
                            style={[
                              styles.gradeFill,
                              {
                                width,
                              },
                            ]}
                          />
                        </View>

                        <Text
                          style={
                            styles.gradeCount
                          }
                        >
                          {
                            item.count
                          }
                        </Text>
                      </View>
                    );
                  },
                )}
              </View>

              <SectionHeader
                title="Recent sessions"
                scheme={scheme}
              />

              <View
                style={
                  styles.recentList
                }
              >
                {recentSessions.map(
                  (session) => {
                    const highest =
                      getHighestGrade(
                        session.boulders,
                      );

                    return (
                      <View
                        key={
                          session.id
                        }
                        style={
                          styles.recentRow
                        }
                      >
                        <View
                          style={
                            styles.recentText
                          }
                        >
                          <Text
                            numberOfLines={1}
                            style={
                              styles.recentGym
                            }
                          >
                            {
                              session.gymName
                            }
                          </Text>

                          <Text
                            style={
                              styles.recentMeta
                            }
                          >
                            {new Date(
                              session.finishedAt!,
                            ).toLocaleDateString(
                              'en-GB',
                              {
                                day:
                                  'numeric',
                                month:
                                  'short',
                              },
                            )}
                            {' · '}
                            {
                              session.boulders.length
                            }{' '}
                            {session.boulders.length ===
                            1
                              ? 'boulder'
                              : 'boulders'}
                            {' · '}
                            {formatDuration(
                              session.startedAt,
                              session.finishedAt,
                            )}
                          </Text>
                        </View>

                        <GradeBadge
                          grade={
                            highest ??
                            '—'
                          }
                          scheme={scheme}
                        />
                      </View>
                    );
                  },
                )}
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

    scrollView: {
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
      marginBottom:
        Spacing.xl,
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

    loadingStack: {
      gap:
        Spacing.sm,
    },

    stateBlock: {
      paddingVertical:
        Spacing.xl,
      borderTopWidth:
        Stroke.default,
      borderBottomWidth:
        Stroke.default,
      borderColor:
        theme.border,
    },

    stateTitle: {
      color:
        theme.textPrimary,
      ...Typography.heading,
    },

    stateText: {
      color:
        theme.textMuted,
      ...Typography.body,
      marginTop:
        Spacing.xs,
    },

    performanceHeader: {
      flexDirection:
        'row',
      alignItems:
        'stretch',
      gap:
        Spacing.xl,
      paddingVertical:
        Spacing.lg,
      borderTopWidth:
        Stroke.default,
      borderBottomWidth:
        Stroke.default,
      borderColor:
        theme.border,
    },

    bestGradeBlock: {
      width: 128,
      justifyContent:
        'center',
    },

    bestGradeLabel: {
      color:
        theme.textMuted,
      ...Typography.caption,
    },

    bestGrade: {
      color:
        theme.textPrimary,
      fontSize: 48,
      lineHeight: 52,
      fontWeight: '700',
      letterSpacing: -1,
      marginTop: 2,
    },

    performanceSummary: {
      flex: 1,
      justifyContent:
        'center',
    },

    weekStrip: {
      minHeight: 88,
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        theme.surface,
      borderWidth:
        Stroke.default,
      borderColor:
        theme.border,
      borderRadius:
        Radius.md,
    },

    primaryMetric: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingVertical:
        Spacing.sm,
    },

    primaryMetricValue: {
      color:
        theme.textPrimary,
      ...Typography.metricLarge,
      fontFamily:
        Fonts.mono,
    },

    primaryMetricLabel: {
      color:
        theme.textMuted,
      ...Typography.caption,
      marginTop: 2,
    },

    verticalDivider: {
      width: 1,
      height: 38,
      backgroundColor:
        theme.border,
    },

    resultTable: {
      borderTopWidth:
        Stroke.default,
      borderBottomWidth:
        Stroke.default,
      borderColor:
        theme.border,
    },

    dataRow: {
      minHeight: 48,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      gap:
        Spacing.md,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        theme.border,
    },

    dataRowLast: {
      borderBottomWidth: 0,
    },

    dataRowLabel: {
      flex: 1,
      color:
        theme.textSecondary,
      ...Typography.body,
    },

    dataRowValue: {
      color:
        theme.textPrimary,
      ...Typography.metric,
      fontFamily:
        Fonts.mono,
      textAlign: 'right',
    },

    gradeChart: {
      gap:
        Spacing.sm,
      paddingVertical:
        Spacing.xs,
    },

    gradeRow: {
      minHeight: 36,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        Spacing.sm,
    },

    gradeLabel: {
      width: 56,
      color:
        theme.textPrimary,
      ...Typography.bodyStrong,
      fontFamily:
        Fonts.mono,
    },

    gradeTrack: {
      flex: 1,
      height: 10,
      backgroundColor:
        theme.surfacePressed,
      borderRadius:
        Radius.sm,
      overflow:
        'hidden',
    },

    gradeFill: {
      height: '100%',
      backgroundColor:
        theme.action,
      borderRadius:
        Radius.sm,
    },

    gradeCount: {
      width: 32,
      color:
        theme.textSecondary,
      ...Typography.metric,
      fontFamily:
        Fonts.mono,
      textAlign: 'right',
    },

    recentList: {
      borderTopWidth:
        Stroke.default,
      borderTopColor:
        theme.border,
    },

    recentRow: {
      minHeight: 72,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        Spacing.md,
      borderBottomWidth:
        Stroke.default,
      borderBottomColor:
        theme.border,
      paddingVertical:
        Spacing.xs,
    },

    recentText: {
      flex: 1,
      minWidth: 0,
    },

    recentGym: {
      color:
        theme.textPrimary,
      ...Typography.bodyStrong,
    },

    recentMeta: {
      color:
        theme.textMuted,
      ...Typography.caption,
      marginTop: 2,
    },
  });