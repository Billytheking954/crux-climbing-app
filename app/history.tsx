import { SafeAreaView } from 'react-native-safe-area-context';
import {
  router,
  useFocusEffect,
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
} from '@/components/climbing/GradeBadge';
import {
  Skeleton,
} from '@/components/core/Skeleton';

import {
  CruxTheme,
  DefaultCruxScheme,
  Fonts,
  Layout,
  Spacing,
  Stroke,
  Typography,
} from '@/constants/theme';

import {
  getHighestGrade,
  getSessions,
  type ClimbingSession,
} from '@/data/storage';

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
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
  );
}

function formatDuration(
  startedAt: string,
  finishedAt?: string,
): string {
  const start =
    new Date(
      startedAt,
    ).getTime();

  const end =
    finishedAt
      ? new Date(
          finishedAt,
        ).getTime()
      : Date.now();

  const totalMinutes =
    Math.max(
      0,
      Math.floor(
        (end - start) /
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

function getSessionStats(
  session: ClimbingSession,
) {
  const boulders =
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

  const attempts =
    boulders.reduce(
      (total, boulder) =>
        total +
        boulder.attempts,
      0,
    );

  return {
    boulders:
      boulders.length,
    flashes,
    sends,
    attempts,
    highestGrade:
      getHighestGrade(
        boulders,
      ),
  };
}

function HistoryLoading() {
  return (
    <View
      style={
        styles.loadingList
      }
    >
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

      <Skeleton
        scheme={scheme}
        height={76}
      />
    </View>
  );
}

export default function HistoryScreen() {
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

  const loadHistory =
    useCallback(
      async () => {
        setLoadError(null);

        try {
          const savedSessions =
            await getSessions();

          const finishedSessions =
            savedSessions
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
              );

          setSessions(
            finishedSessions,
          );
        } catch (error) {
          console.error(
            'Failed to load history:',
            error,
          );

          setLoadError(
            'CRUX could not load your session history.',
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  useFocusEffect(
    useCallback(
      () => {
        void loadHistory();
      },
      [loadHistory],
    ),
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
            <View>
              <Text
                style={
                  styles.title
                }
              >
                History
              </Text>

              <Text
                style={
                  styles.subtitle
                }
              >
                Completed climbing sessions
              </Text>
            </View>

            {!loading ? (
              <Text
                style={
                  styles.sessionCount
                }
              >
                {
                  sessions.length
                }
              </Text>
            ) : null}
          </View>

          {loading ? (
            <HistoryLoading />
          ) : loadError ? (
            <View
              style={
                styles.messageState
              }
            >
              <Text
                style={
                  styles.messageTitle
                }
              >
                Couldn’t load history
              </Text>

              <Text
                style={
                  styles.messageText
                }
              >
                {loadError}
              </Text>
            </View>
          ) : sessions.length ===
            0 ? (
            <View
              style={
                styles.messageState
              }
            >
              <Text
                style={
                  styles.messageTitle
                }
              >
                No finished sessions
              </Text>

              <Text
                style={
                  styles.messageText
                }
              >
                Complete a climbing session and it will appear here.
              </Text>
            </View>
          ) : (
            <View
              style={
                styles.sessionList
              }
            >
              {sessions.map(
                (session) => {
                  const stats =
                    getSessionStats(
                      session,
                    );

                  return (
                    <Pressable
                      key={
                        session.id
                      }
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
                      style={({
                        pressed,
                      }) => [
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
                          styles.sessionMain
                        }
                      >
                        <Text
                          numberOfLines={
                            1
                          }
                          ellipsizeMode="tail"
                          style={
                            styles.gymName
                          }
                        >
                          {
                            session.gymName
                          }
                        </Text>

                        <Text
                          style={
                            styles.date
                          }
                        >
                          {formatDate(
                            session.finishedAt!,
                          )}
                        </Text>

                        <Text
                          numberOfLines={
                            1
                          }
                          style={
                            styles.meta
                          }
                        >
                          {
                            stats.boulders
                          }{' '}
                          boulders
                          {' · '}
                          {
                            stats.attempts
                          }{' '}
                          attempts
                          {' · '}
                          {formatDuration(
                            session.startedAt,
                            session.finishedAt,
                          )}
                        </Text>

                        <Text
                          numberOfLines={
                            1
                          }
                          style={
                            styles.secondaryMeta
                          }
                        >
                          {
                            stats.flashes
                          }{' '}
                          flashes
                          {' · '}
                          {
                            stats.sends
                          }{' '}
                          sends
                        </Text>
                      </View>

                      <View
                        style={
                          styles.gradeColumn
                        }
                      >
                        <GradeBadge
                          grade={
                            stats.highestGrade ??
                            '—'
                          }
                          scheme={
                            scheme
                          }
                        />
                      </View>
                    </Pressable>
                  );
                },
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
      flexDirection: 'row',
      alignItems:
        'flex-start',
      justifyContent:
        'space-between',
      gap: Spacing.md,
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

    sessionCount: {
      color:
        theme.textMuted,
      ...Typography.metric,
      fontFamily:
        Fonts.mono,
      marginTop:
        Spacing.xs,
    },

    loadingList: {
      gap: Spacing.sm,
      marginTop:
        Spacing.sm,
    },

    messageState: {
      paddingVertical:
        Spacing.xl,
      borderTopWidth:
        Stroke.default,
      borderBottomWidth:
        Stroke.default,
      borderColor:
        theme.border,
    },

    messageTitle: {
      color:
        theme.textPrimary,
      ...Typography.heading,
    },

    messageText: {
      color:
        theme.textMuted,
      ...Typography.body,
      marginTop:
        Spacing.xxs,
      maxWidth: 430,
    },

    sessionList: {
      borderTopWidth:
        Stroke.default,
      borderTopColor:
        theme.border,
    },

    sessionRow: {
      minHeight: 104,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      borderBottomWidth:
        Stroke.default,
      borderBottomColor:
        theme.border,
      paddingVertical:
        Spacing.sm,
      paddingHorizontal:
        Spacing.xxs,
      marginHorizontal:
        -Spacing.xxs,
    },

    sessionMain: {
      flex: 1,
      minWidth: 0,
    },

    gymName: {
      color:
        theme.textPrimary,
      ...Typography.heading,
    },

    date: {
      color:
        theme.textSecondary,
      ...Typography.caption,
      marginTop:
        Spacing.xxs,
    },

    meta: {
      color:
        theme.textSecondary,
      ...Typography.caption,
      marginTop:
        Spacing.xs,
    },

    secondaryMeta: {
      color:
        theme.textMuted,
      ...Typography.caption,
      marginTop: 2,
    },

    gradeColumn: {
      alignItems: 'center',
      justifyContent:
        'center',
    },
  });