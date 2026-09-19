import { SafeAreaView } from 'react-native-safe-area-context';
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
  View,
} from 'react-native';

import {
  GradeBadge,
  type GradeBadgeTone,
} from '@/components/climbing/GradeBadge';
import {
  AppButton,
} from '@/components/core/AppButton';
import {
  Skeleton,
} from '@/components/core/Skeleton';

import {
  CruxTheme,
  DefaultCruxScheme,
  Fonts,
  Layout,
  Size,
  Spacing,
  Stroke,
  Typography
} from '@/constants/theme';

import {
  getHighestGrade,
  getSessionById,
  type Boulder,
  type BoulderResult,
  type ClimbingSession,
} from '@/data/storage';

import {
  resolveRouteParam,
} from '@/utils/climbing';

const scheme =
  DefaultCruxScheme;

const theme =
  CruxTheme[scheme];

function formatDate(
  dateString: string,
): string {
  return new Date(
    dateString,
  ).toLocaleDateString(
    'en-GB',
    {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    },
  );
}

function formatTime(
  dateString: string,
): string {
  return new Date(
    dateString,
  ).toLocaleTimeString(
    'en-GB',
    {
      hour: '2-digit',
      minute: '2-digit',
    },
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
        difference /
          60000,
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

  return `${hours}h ${minutes
    .toString()
    .padStart(2, '0')}m`;
}

function formatChoices(
  value: string | string[] | undefined,
): string {
  if (!value) return '—';
  return Array.isArray(value)
    ? value.join(' · ')
    : value;
}

function getResultTone(
  result: BoulderResult,
): GradeBadgeTone {
  switch (result) {
    case 'Flash':
    case 'Send':
    case 'Completed':
      return 'success';

    case 'Project':
      return 'warning';

    default:
      return 'neutral';
  }
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

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View
      style={
        styles.detailRow
      }
    >
      <Text
        style={
          styles.detailLabel
        }
      >
        {label}
      </Text>

      <Text
        numberOfLines={1}
        style={
          styles.detailValue
        }
      >
        {value}
      </Text>
    </View>
  );
}

export default function SessionDetailsScreen() {
  const { sessionId } =
    useLocalSearchParams<{
      sessionId?:
        | string
        | string[];
    }>();

  const resolvedSessionId =
    resolveRouteParam(
      sessionId,
    );

  const [
    session,
    setSession,
  ] =
    useState<ClimbingSession | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const loadSession =
    useCallback(
      async () => {
        if (
          !resolvedSessionId
        ) {
          setLoading(false);
          return;
        }

        try {
          const savedSession =
            await getSessionById(
              resolvedSessionId,
            );

          setSession(
            savedSession,
          );
        } catch (error) {
          console.error(
            'Failed to load session details:',
            error,
          );
        } finally {
          setLoading(false);
        }
      },
      [resolvedSessionId],
    );

  useFocusEffect(
    useCallback(() => {
      void loadSession();
    }, [loadSession]),
  );

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
            width="55%"
            height={32}
          />

          <Skeleton
            scheme={scheme}
            height={94}
          />

          <Skeleton
            scheme={scheme}
            height={76}
          />

          <Skeleton
            scheme={scheme}
            height={76}
          />

          <Skeleton
            scheme={scheme}
            height={76}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
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
            Session not found
          </Text>

          <Text
            style={
              styles.notFoundText
            }
          >
            This climbing session could not be loaded.
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

  const boulders: Boulder[] =
    session.boulders;

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

  const projects =
    boulders.filter(
      (boulder) =>
        boulder.result ===
        'Project',
    ).length;

  const completed =
    boulders.filter(
      (boulder) =>
        boulder.result ===
        'Completed',
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

  const highestGrade =
    getHighestGrade(
      boulders,
    );

  const flashRate =
    boulders.length > 0
      ? Math.round(
          (flashes /
            boulders.length) *
            100,
        )
      : 0;

  const displayDate =
    session.finishedAt ??
    session.startedAt;

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
              style={({ pressed }) => [
                styles.backButton,
                {
                  opacity:
                    pressed
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
                numberOfLines={1}
                style={
                  styles.title
                }
              >
                {
                  session.gymName
                }
              </Text>

              <Text
                style={
                  styles.subtitle
                }
              >
                Session details
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit session"
              onPress={() =>
                router.push({
                  pathname:
                    '/edit-session',
                  params: {
                    sessionId:
                      session.id,
                  },
                })
              }
              style={({ pressed }) => [
                styles.editButton,
                {
                  opacity:
                    pressed
                      ? 0.55
                      : 1,
                },
              ]}
            >
              <Text
                style={
                  styles.editText
                }
              >
                Edit
              </Text>
            </Pressable>
          </View>

          <View
            style={
              styles.sessionSummary
            }
          >
            <Text
              style={
                styles.date
              }
            >
              {formatDate(
                displayDate,
              )}
            </Text>

            <View
              style={
                styles.timeLine
              }
            >
              <Text
                style={
                  styles.time
                }
              >
                {formatTime(
                  session.startedAt,
                )}
              </Text>

              <View
                style={
                  styles.timeDivider
                }
              />

              <Text
                style={
                  styles.time
                }
              >
                {session.finishedAt
                  ? formatTime(
                      session.finishedAt,
                    )
                  : 'In progress'}
              </Text>

              <Text
                style={
                  styles.duration
                }
              >
                {formatDuration(
                  session.startedAt,
                  session.finishedAt,
                )}
              </Text>
            </View>
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
              label="Attempts"
              value={attempts}
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
              label="Flashes"
              value={flashes}
            />
          </View>

          <View
            style={
              styles.performance
            }
          >
            <DetailRow
              label="Hardest grade"
              value={
                highestGrade ??
                '—'
              }
            />

            <DetailRow
              label="Flash rate"
              value={`${flashRate}%`}
            />

            <DetailRow
              label="Completed"
              value={String(
                completed,
              )}
            />

            <DetailRow
              label="Projects"
              value={String(
                projects,
              )}
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
              Boulders
            </Text>

            <Text
              style={
                styles.sectionCount
              }
            >
              {
                boulders.length
              }
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
                No boulders recorded
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                This session was saved without any logged climbs.
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
                  index,
                ) => (
                  <Pressable
                    key={
                      boulder.id
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${boulder.name ?? boulder.grade}`}
                    onPress={() =>
                      router.push({
                        pathname:
                          '/edit-boulder',
                        params: {
                          sessionId:
                            session.id,
                          boulderId:
                            boulder.id,
                        },
                      })
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
                    <Text
                      style={
                        styles.climbNumber
                      }
                    >
                      {index + 1}
                    </Text>

                    <GradeBadge
                      grade={
                        boulder.grade
                      }
                      tone={getResultTone(
                        boulder.result,
                      )}
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
                          styles.climbPrimaryMeta
                        }
                      >
                        {boulder.name
                          ? `${boulder.result} · `
                          : ''}
                        {
                          boulder.attempts
                        }{' '}
                        {boulder.attempts ===
                        1
                          ? 'attempt'
                          : 'attempts'}
                        {' · '}
                        {
                          boulder.terrain
                        }
                      </Text>

                      <Text
                        numberOfLines={
                          1
                        }
                        style={
                          styles.climbSecondaryMeta
                        }
                      >
                        {formatChoices(
                          boulder.holdType,
                        )}
                      </Text>

                      <Text
                        numberOfLines={
                          1
                        }
                        style={
                          styles.climbSecondaryMeta
                        }
                      >
                        {formatChoices(
                          boulder.movementType,
                        )}
                      </Text>
                    </View>
                  </Pressable>
                ),
              )}
            </View>
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

    loadingContainer: {
      flex: 1,
      gap: Spacing.md,
      padding:
        Layout.horizontalPadding,
      paddingTop:
        Spacing.xxl,
      backgroundColor:
        theme.background,
    },

    notFound: {
      flex: 1,
      justifyContent:
        'center',
      gap: Spacing.sm,
      padding:
        Layout.horizontalPadding,
      backgroundColor:
        theme.background,
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

    editButton: {
      minWidth:
        Size.touchTarget,
      minHeight:
        Size.touchTarget,
      alignItems: 'center',
      justifyContent:
        'center',
      paddingHorizontal:
        Spacing.xs,
    },

    editText: {
      color:
        theme.action,
      ...Typography.bodyStrong,
      fontSize: 14,
    },

    sessionSummary: {
      paddingVertical:
        Spacing.md,
      borderTopWidth:
        Stroke.default,
      borderBottomWidth:
        Stroke.default,
      borderColor:
        theme.border,
    },

    date: {
      color:
        theme.textPrimary,
      ...Typography.bodyStrong,
    },

    timeLine: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop:
        Spacing.xs,
    },

    time: {
      color:
        theme.textSecondary,
      ...Typography.metric,
      fontFamily:
        Fonts.mono,
    },

    timeDivider: {
      width: 18,
      height: 1,
      backgroundColor:
        theme.borderStrong,
    },

    duration: {
      color:
        theme.textMuted,
      ...Typography.caption,
      marginLeft: 'auto',
    },

    metrics: {
      minHeight: 82,
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

    performance: {
      borderBottomWidth:
        Stroke.default,
      borderBottomColor:
        theme.border,
    },

    detailRow: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      gap: Spacing.md,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        theme.border,
    },

    detailLabel: {
      color:
        theme.textSecondary,
      ...Typography.body,
    },

    detailValue: {
      color:
        theme.textPrimary,
      ...Typography.metric,
      fontFamily:
        Fonts.mono,
      textAlign: 'right',
    },

    sectionHeader: {
      minHeight: 56,
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
      fontFamily:
        Fonts.mono,
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
    },

    climbList: {
      borderTopWidth:
        Stroke.default,
      borderTopColor:
        theme.border,
    },

    climbRow: {
      minHeight: 90,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical:
        Spacing.sm,
      paddingHorizontal:
        Spacing.xxs,
      marginHorizontal:
        -Spacing.xxs,
      borderBottomWidth:
        Stroke.default,
      borderBottomColor:
        theme.border,
    },

    climbNumber: {
      width: 20,
      color:
        theme.textMuted,
      ...Typography.caption,
      textAlign: 'center',
      fontFamily:
        Fonts.mono,
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

    climbPrimaryMeta: {
      color:
        theme.textSecondary,
      ...Typography.caption,
      marginTop: 2,
    },

    climbSecondaryMeta: {
      color:
        theme.textMuted,
      ...Typography.caption,
      marginTop: 1,
    },
  });