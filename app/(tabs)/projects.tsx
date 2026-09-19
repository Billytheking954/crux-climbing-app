import { SafeAreaView } from 'react-native-safe-area-context';
import {
  router,
  useFocusEffect,
} from 'expo-router';
import {
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  Image,
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
  Skeleton,
} from '@/components/core/Skeleton';

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
  createProject,
  getProjects,
  getSessions,
  type ClimbingProject,
  type ClimbingSession,
} from '@/data/storage';

import {
  showMessage,
} from '@/utils/dialogs';

import {
  normalizeVGradeInput,
} from '@/utils/climbing';

const scheme =
  DefaultCruxScheme;

const theme =
  CruxTheme[scheme];

function formatProjectDate(
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

function ProjectMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View
      style={
        styles.projectMetric
      }
    >
      <Text
        style={
          styles.projectMetricValue
        }
      >
        {value}
      </Text>

      <Text
        style={
          styles.projectMetricLabel
        }
      >
        {label}
      </Text>
    </View>
  );
}

export default function ProjectsScreen() {
  const [
    projects,
    setProjects,
  ] =
    useState<
      ClimbingProject[]
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
  ] = useState(false);

  const [
    name,
    setName,
  ] = useState('');

  const [
    grade,
    setGrade,
  ] = useState('V5');

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    loadError,
    setLoadError,
  ] =
    useState<
      string | null
    >(null);

  const loadProjects =
    useCallback(async () => {
      try {
        setLoadError(null);

        const [
          savedProjects,
          savedSessions,
        ] =
          await Promise.all([
            getProjects(),
            getSessions(),
          ]);

        setProjects(
          savedProjects,
        );

        setSessions(
          savedSessions,
        );
      } catch (error) {
        console.error(
          'Failed to load projects:',
          error,
        );

        setLoadError(
          'CRUX could not load your projects.',
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProjects();
    }, [loadProjects]),
  );

  const projectStats =
    useMemo(() => {
      return projects.map(
        (project) => {
          const boulders =
            sessions
              .flatMap(
                (session) =>
                  session.boulders,
              )
              .filter(
                (boulder) =>
                  boulder.projectId ===
                  project.id,
              );

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

          const sessionIds =
            new Set(
              boulders.map(
                (boulder) =>
                  boulder.sessionId,
              ),
            );

          return {
            project,
            attempts,
            sessions:
              sessionIds.size,
            entries:
              boulders.length,
          };
        },
      );
    }, [
      projects,
      sessions,
    ]);

  const activeProjects =
    projectStats
      .filter(
        (item) =>
          item.project.status ===
          'active',
      )
      .sort(
        (a, b) =>
          new Date(
            b.project.createdAt,
          ).getTime() -
          new Date(
            a.project.createdAt,
          ).getTime(),
      );

  const completedProjects =
    projectStats
      .filter(
        (item) =>
          item.project.status ===
          'completed',
      )
      .sort(
        (a, b) =>
          new Date(
            b.project.completedAt ??
              b.project.createdAt,
          ).getTime() -
          new Date(
            a.project.completedAt ??
              a.project.createdAt,
          ).getTime(),
      );

  const saveProject =
    async () => {
      if (saving) {
        return;
      }

      if (!name.trim()) {
        showMessage(
          'Project name required',
          'Give your project a name.',
        );

        return;
      }

      const normalizedGrade =
        normalizeVGradeInput(
          grade,
        );

      if (!normalizedGrade) {
        showMessage(
          'Invalid grade',
          'Use a V-grade such as V5 or a range such as V5-V6.',
        );

        return;
      }

      try {
        setSaving(true);

        await createProject(
          name.trim(),
          normalizedGrade,
        );

        setName('');
        setGrade('V5');
        setShowCreate(false);

        await loadProjects();
      } catch (error) {
        console.error(
          'Failed to create project:',
          error,
        );

        showMessage(
          'Could not create project',
          'Something went wrong while creating the project.',
        );
      } finally {
        setSaving(false);
      }
    };

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
                Projects
              </Text>

              <Text
                style={
                  styles.subtitle
                }
              >
                Track climbs across multiple sessions
              </Text>
            </View>

            {!loading ? (
              <Text
                style={
                  styles.projectCount
                }
              >
                {
                  activeProjects.length
                }
              </Text>
            ) : null}
          </View>

          <AppButton
            label={
              showCreate
                ? 'Cancel'
                : 'New project'
            }
            variant={
              showCreate
                ? 'secondary'
                : 'primary'
            }
            scheme={scheme}
            disabled={saving}
            onPress={() =>
              setShowCreate(
                (current) =>
                  !current,
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
                  Project name
                </Text>

                <TextInput
                  value={name}
                  onChangeText={
                    setName
                  }
                  placeholder="Blue arete"
                  placeholderTextColor={
                    theme.textMuted
                  }
                  style={
                    styles.input
                  }
                  autoCapitalize="words"
                  maxLength={60}
                  editable={!saving}
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
                  Grade
                </Text>

                <TextInput
                  value={grade}
                  onChangeText={
                    setGrade
                  }
                  placeholder="V5 or V5-V6"
                  placeholderTextColor={
                    theme.textMuted
                  }
                  style={
                    styles.input
                  }
                  autoCapitalize="characters"
                  maxLength={12}
                  editable={!saving}
                />

                <Text
                  style={
                    styles.fieldHint
                  }
                >
                  You can add photos after creating the project.
                </Text>
              </View>

              <AppButton
                label="Create project"
                loading={saving}
                scheme={scheme}
                disabled={
                  !name.trim()
                }
                onPress={() => {
                  void saveProject();
                }}
              />
            </View>
          ) : null}

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
              Active
            </Text>

            {!loading ? (
              <Text
                style={
                  styles.sectionCount
                }
              >
                {
                  activeProjects.length
                }
              </Text>
            ) : null}
          </View>

          {loading ? (
            <View
              style={
                styles.loadingList
              }
            >
              <Skeleton
                scheme={scheme}
                height={92}
              />

              <Skeleton
                scheme={scheme}
                height={92}
              />

              <Skeleton
                scheme={scheme}
                height={92}
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
                Couldn’t load projects
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                {loadError}
              </Text>
            </View>
          ) : activeProjects.length ===
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
                No active projects
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Create a project, then link boulder attempts to it while logging.
              </Text>
            </View>
          ) : (
            <View
              style={
                styles.projectList
              }
            >
              {activeProjects.map(
                ({
                  project,
                  attempts,
                  sessions:
                    projectSessions,
                  entries,
                }) => {
                  const cover =
                    project.photos?.[0];

                  return (
                    <Pressable
                      key={
                        project.id
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${project.name}`}
                      disabled={saving}
                      onPress={() =>
                        router.push({
                          pathname:
                            '/project-details',
                          params: {
                            projectId:
                              project.id,
                          },
                        })
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.projectRow,
                        {
                          backgroundColor:
                            pressed
                              ? theme.surfacePressed
                              : 'transparent',
                          opacity:
                            saving
                              ? 0.5
                              : 1,
                        },
                      ]}
                    >
                      {cover ? (
                        <Image
                          source={{
                            uri: cover.uri,
                          }}
                          style={
                            styles.thumbnail
                          }
                        />
                      ) : (
                        <GradeBadge
                          grade={
                            project.grade
                          }
                          tone="warning"
                          scheme={scheme}
                        />
                      )}

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
                            styles.projectGradeText
                          }
                        >
                          {
                            project.grade
                          }
                        </Text>

                        <Text
                          numberOfLines={
                            1
                          }
                          style={
                            styles.projectMeta
                          }
                        >
                          {
                            projectSessions
                          }{' '}
                          {projectSessions ===
                          1
                            ? 'session'
                            : 'sessions'}
                          {' · '}
                          {
                            entries
                          }{' '}
                          {entries ===
                          1
                            ? 'entry'
                            : 'entries'}
                        </Text>
                      </View>

                      <ProjectMetric
                        label="Attempts"
                        value={
                          attempts
                        }
                      />
                    </Pressable>
                  );
                },
              )}
            </View>
          )}

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
              Completed
            </Text>

            {!loading ? (
              <Text
                style={
                  styles.sectionCount
                }
              >
                {
                  completedProjects.length
                }
              </Text>
            ) : null}
          </View>

          {!loading &&
          completedProjects.length ===
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
                Nothing completed yet
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Finished projects will stay here as part of your climbing history.
              </Text>
            </View>
          ) : (
            <View
              style={
                styles.projectList
              }
            >
              {completedProjects.map(
                ({
                  project,
                  attempts,
                  sessions:
                    projectSessions,
                }) => {
                  const cover =
                    project.photos?.[0];

                  return (
                    <Pressable
                      key={
                        project.id
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Open completed project ${project.name}`}
                      disabled={saving}
                      onPress={() =>
                        router.push({
                          pathname:
                            '/project-details',
                          params: {
                            projectId:
                              project.id,
                          },
                        })
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.projectRow,
                        {
                          backgroundColor:
                            pressed
                              ? theme.surfacePressed
                              : 'transparent',
                        },
                      ]}
                    >
                      {cover ? (
                        <Image
                          source={{
                            uri: cover.uri,
                          }}
                          style={
                            styles.thumbnail
                          }
                        />
                      ) : (
                        <GradeBadge
                          grade={
                            project.grade
                          }
                          tone="success"
                          scheme={scheme}
                        />
                      )}

                      <View
                        style={
                          styles.projectContent
                        }
                      >
                        <View
                          style={
                            styles.completedTitleRow
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
                              styles.completedStatus
                            }
                          >
                            Completed
                          </Text>
                        </View>

                        <Text
                          style={
                            styles.projectGradeText
                          }
                        >
                          {
                            project.grade
                          }
                        </Text>

                        <Text
                          style={
                            styles.projectMeta
                          }
                        >
                          {
                            attempts
                          }{' '}
                          attempts
                          {' · '}
                          {
                            projectSessions
                          }{' '}
                          {projectSessions ===
                          1
                            ? 'session'
                            : 'sessions'}
                        </Text>

                        {project.completedAt ? (
                          <Text
                            style={
                              styles.completedDate
                            }
                          >
                            Completed{' '}
                            {formatProjectDate(
                              project.completedAt,
                            )}
                          </Text>
                        ) : null}
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
      justifyContent:
        'space-between',
      alignItems:
        'flex-start',
      gap: Spacing.md,
      marginBottom:
        Spacing.md,
    },

    headerText: {
      flex: 1,
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

    projectCount: {
      color:
        theme.textMuted,
      ...Typography.metric,
      fontFamily:
        Fonts.mono,
      marginTop:
        Spacing.xs,
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

    loadingList: {
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

    projectList: {
      borderTopWidth:
        Stroke.default,
      borderTopColor:
        theme.border,
    },

    projectRow: {
      minHeight: 92,
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

    thumbnail: {
      width: 54,
      height: 54,
      borderRadius:
        Radius.md,
      backgroundColor:
        theme.surfacePressed,
    },

    projectContent: {
      flex: 1,
      minWidth: 0,
    },

    projectName: {
      flexShrink: 1,
      color:
        theme.textPrimary,
      ...Typography.bodyStrong,
    },

    projectGradeText: {
      color:
        theme.project,
      ...Typography.label,
      marginTop: 2,
    },

    projectMeta: {
      color:
        theme.textMuted,
      ...Typography.caption,
      marginTop:
        Spacing.xxs,
    },

    projectMetric: {
      alignItems:
        'flex-end',
      minWidth: 58,
    },

    projectMetricValue: {
      color:
        theme.textPrimary,
      ...Typography.metric,
      fontFamily:
        Fonts.mono,
    },

    projectMetricLabel: {
      color:
        theme.textMuted,
      ...Typography.caption,
      fontSize: 10,
      marginTop: 1,
    },

    completedTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },

    completedStatus: {
      color:
        theme.success,
      ...Typography.label,
      fontSize: 10,
    },

    completedDate: {
      color:
        theme.textMuted,
      ...Typography.caption,
      marginTop: 2,
    },
  });