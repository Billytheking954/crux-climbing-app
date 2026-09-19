import { ProjectImage } from '@/components/climbing/ProjectImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Modal,
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
  addProjectPhoto,
  completeProject,
  deleteProject,
  getProjects,
  getSessions,
  gradeToNumber,
  removeProjectPhoto,
  updateProject,
  type Boulder,
  type ClimbingProject,
  type ClimbingSession,
  type ProjectPhoto,
} from '@/data/storage';

import {
  confirmAction,
  showMessage,
} from '@/utils/dialogs';

import {
  persistProjectPhoto,
  removePersistedProjectPhoto,
} from '@/features/media/media-processor';

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
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
  );
}

function getDuration(
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
  value:
    | string
    | string[]
    | undefined,
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

export default function ProjectDetailsScreen() {
  const { projectId } =
    useLocalSearchParams<{
      projectId?:
        | string
        | string[];
    }>();

  const resolvedProjectId =
    resolveRouteParam(
      projectId,
    );

  const [
    project,
    setProject,
  ] =
    useState<ClimbingProject | null>(
      null,
    );

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
  ] = useState(true);

  const [
    mutating,
    setMutating,
  ] = useState(false);

  const [
    selectedPhoto,
    setSelectedPhoto,
  ] =
    useState<ProjectPhoto | null>(
      null,
    );

  const loadProject =
    useCallback(
      async () => {
        if (
          !resolvedProjectId
        ) {
          setProject(null);
          setSessions([]);
          setLoading(false);

          return;
        }

        try {
          const [
            savedProjects,
            savedSessions,
          ] =
            await Promise.all([
              getProjects(),
              getSessions(),
            ]);

          const foundProject =
            savedProjects.find(
              (item) =>
                item.id ===
                resolvedProjectId,
            ) ?? null;

          setProject(
            foundProject,
          );

          const relatedSessions =
            savedSessions.filter(
              (session) =>
                session.boulders.some(
                  (boulder) =>
                    boulder.projectId ===
                    resolvedProjectId,
                ),
            );

          setSessions(
            relatedSessions,
          );
        } catch (error) {
          console.error(
            'Failed to load project:',
            error,
          );
        } finally {
          setLoading(false);
        }
      },
      [resolvedProjectId],
    );

  useFocusEffect(
    useCallback(() => {
      void loadProject();
    }, [loadProject]),
  );

  const projectBoulders: Boulder[] =
    useMemo(
      () =>
        sessions
          .flatMap(
            (session) =>
              session.boulders.filter(
                (boulder) =>
                  boulder.projectId ===
                  resolvedProjectId,
              ),
          )
          .sort(
            (a, b) =>
              new Date(
                a.createdAt,
              ).getTime() -
              new Date(
                b.createdAt,
              ).getTime(),
          ),
      [
        sessions,
        resolvedProjectId,
      ],
    );

  const totalAttempts =
    projectBoulders.reduce(
      (
        total,
        boulder,
      ) =>
        total +
        boulder.attempts,
      0,
    );

  const sessionCount =
    new Set(
      projectBoulders.map(
        (boulder) =>
          boulder.sessionId,
      ),
    ).size;

  const highestLoggedGrade =
    projectBoulders.reduce<
      string | null
    >(
      (
        highest,
        boulder,
      ) => {
        if (!highest) {
          return boulder.grade;
        }

        return gradeToNumber(
          boulder.grade,
        ) >
          gradeToNumber(
            highest,
          )
          ? boulder.grade
          : highest;
      },
      null,
    );

  const completed =
    project?.status ===
    'completed';

  const completionLockedByBoulder =
    project?.completionSource ===
      'boulder' ||
    projectBoulders.some(
      (boulder) =>
        boulder.result ===
        'Completed',
    );

  const photoBusy = useRef(false);

  const addPhoto =
    async (source: 'library' | 'camera' = 'library') => {
      if (
        mutating ||
        photoBusy.current ||
        !project ||
        !resolvedProjectId
      ) {
        return;
      }

      try {
        setMutating(true);

        photoBusy.current = true;
        if (source === 'camera') {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) {
            showMessage('Camera permission required', 'Allow camera access in Settings to take a project photo. You can still choose a saved photo.');
            return;
          }
        }
        const options: ImagePicker.ImagePickerOptions = {
          mediaTypes: ['images'], allowsEditing: false, quality: 0.9,
        };
        const result = source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

        if (
          result.canceled
        ) {
          return;
        }

        const asset =
          result.assets[0];

        if (!asset?.uri) {
          return;
        }

        const photo =
          await persistProjectPhoto(
            asset,
          );

        await addProjectPhoto(resolvedProjectId, photo);

        await loadProject();
      } catch (error) {
        console.error(
          'Failed to add project photo:',
          error,
        );

        showMessage(
          'Could not add photo',
          'Something went wrong while adding the photo.',
        );
      } finally {
        photoBusy.current = false;
        setMutating(false);
      }
    };

  const confirmRemovePhoto =
    async (
      photo: ProjectPhoto,
    ) => {
      if (
        !resolvedProjectId ||
        mutating
      ) {
        return;
      }

      const confirmed =
        await confirmAction({
          title:
            'Remove photo?',
          message:
            'This removes the photo from this project.',
          confirmText:
            'Remove',
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

        await removeProjectPhoto(
          resolvedProjectId,
          photo.id,
        );

        try {
          await removePersistedProjectPhoto(
            photo,
          );
        } catch (fileError) {
          console.warn(
            'Project photo record removed but local file cleanup failed:',
            fileError,
          );
        }

        await loadProject();
      } catch (error) {
        console.error(
          'Failed to remove photo:',
          error,
        );

        showMessage(
          'Could not remove photo',
          'Something went wrong.',
        );
      } finally {
        setMutating(false);
      }
    };

  const markCompleted =
    async () => {
      if (
        !resolvedProjectId ||
        mutating
      ) {
        return;
      }

      const confirmed =
        await confirmAction({
          title:
            'Complete project?',
          message:
            'This marks the project as completed. You can reopen manually completed projects later.',
          confirmText:
            'Complete',
          cancelText:
            'Cancel',
        });

      if (!confirmed) {
        return;
      }

      try {
        setMutating(true);

        await completeProject(
          resolvedProjectId,
        );

        await loadProject();

        showMessage(
          'Project completed',
          'This project has been marked as completed.',
        );
      } catch (error) {
        console.error(
          'Failed to complete project:',
          error,
        );

        showMessage(
          'Could not complete project',
          'Something went wrong.',
        );
      } finally {
        setMutating(false);
      }
    };

  const reopenProject =
    async () => {
      if (
        !project ||
        mutating ||
        completionLockedByBoulder
      ) {
        return;
      }

      const confirmed =
        await confirmAction({
          title:
            'Reopen project?',
          message:
            'This moves the project back to your active list.',
          confirmText:
            'Reopen',
          cancelText:
            'Cancel',
        });

      if (!confirmed) {
        return;
      }

      try {
        setMutating(true);

        await updateProject(
          project.id,
          {
            name:
              project.name,
            grade:
              project.grade,
            status:
              'active',
          },
        );

        await loadProject();
      } catch (error) {
        console.error(
          'Failed to reopen project:',
          error,
        );

        showMessage(
          'Could not reopen project',
          'Something went wrong.',
        );
      } finally {
        setMutating(false);
      }
    };

  const confirmDelete =
    async () => {
      if (
        !project ||
        mutating
      ) {
        return;
      }

      const confirmed =
        await confirmAction({
          title:
            'Delete project?',
          message:
            'This removes the project from your project list. Logged climbing sessions will stay.',
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

        await deleteProject(
          project.id,
        );

        router.replace(
          '/(tabs)/projects',
        );
      } catch (error) {
        console.error(
          'Failed to delete project:',
          error,
        );

        showMessage(
          'Could not delete project',
          'Something went wrong.',
        );
      } finally {
        setMutating(false);
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
            width="55%"
            height={32}
          />

          <Skeleton
            scheme={scheme}
            height={76}
          />

          <Skeleton
            scheme={scheme}
            height={88}
          />

          <Skeleton
            scheme={scheme}
            height={120}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!project) {
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
            Project not found
          </Text>

          <Text
            style={
              styles.notFoundText
            }
          >
            This project may have been deleted.
          </Text>

          <AppButton
            label="Back to Projects"
            variant="secondary"
            scheme={scheme}
            onPress={() =>
              router.replace(
                '/(tabs)/projects',
              )
            }
          />
        </View>
      </SafeAreaView>
    );
  }

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
              disabled={mutating}
              style={({
                pressed,
              }) => [
                styles.backButton,
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
                  project.name
                }
              </Text>

              <Text
                style={
                  styles.subtitle
                }
              >
                Project details
              </Text>
            </View>
          </View>

          <View
            style={
              styles.identity
            }
          >
            <GradeBadge
              grade={
                project.grade
              }
              tone={
                completed
                  ? 'success'
                  : 'warning'
              }
              scheme={scheme}
            />

            <View
              style={
                styles.identityText
              }
            >
              <Text
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
                  styles.createdText
                }
              >
                Started{' '}
                {formatDate(
                  project.createdAt,
                )}
              </Text>
            </View>

            <Text
              style={[
                styles.statusText,
                completed
                  ? styles.completedStatus
                  : styles.activeStatus,
              ]}
            >
              {completed
                ? 'Completed'
                : 'Active'}
            </Text>
          </View>

          <View
            style={
              styles.metrics
            }
          >
            <Metric
              label="Attempts"
              value={
                totalAttempts
              }
            />

            <View
              style={
                styles.metricDivider
              }
            />

            <Metric
              label="Sessions"
              value={
                sessionCount
              }
            />

            <View
              style={
                styles.metricDivider
              }
            />

            <Metric
              label="Entries"
              value={
                projectBoulders.length
              }
            />
          </View>

          <View
            style={
              styles.gradeSummary
            }
          >
            <Text
              style={
                styles.gradeSummaryLabel
              }
            >
              Highest logged grade
            </Text>

            <Text
              style={
                styles.gradeSummaryValue
              }
            >
              {highestLoggedGrade ??
                '—'}
            </Text>
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
              Photos
            </Text>

            <Text
              style={
                styles.sectionCount
              }
            >
              {
                project.photos
                  ?.length ??
                0
              }
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.photoStrip
            }
          >
            {(project.photos ??
              []).map(
                (photo) => (
                  <View
                    key={
                      photo.id
                    }
                    style={
                      styles.photoItem
                    }
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="View project photo full screen"
                      onPress={() =>
                        setSelectedPhoto(
                          photo,
                        )
                      }
                      disabled={
                        mutating
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.photoPreviewButton,
                        {
                          opacity:
                            mutating
                              ? 0.4
                              : pressed
                                ? 0.8
                                : 1,
                        },
                      ]}
                    >
                      <ProjectImage
                        uri={photo.uri}
                        style={
                          styles.photo
                        }
                        resizeMode="cover"
                      />
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Remove project photo"
                      onPress={() => {
                        void confirmRemovePhoto(
                          photo,
                        );
                      }}
                      disabled={
                        mutating
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.removePhotoButton,
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
                          styles.removePhotoText
                        }
                      >
                        Remove
                      </Text>
                    </Pressable>
                  </View>
                ),
              )}

            <AppButton
              label="Take photo"
              scheme={scheme}
              disabled={mutating}
              onPress={() => { void addPhoto('camera'); }}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add project photo"
              onPress={() => {
                void addPhoto();
              }}
              disabled={mutating}
              style={({
                pressed,
              }) => [
                styles.addPhotoButton,
                {
                  opacity:
                    mutating
                      ? 0.4
                      : pressed
                        ? 0.6
                        : 1,
                },
              ]}
            >
              <Text
                style={
                  styles.addPhotoSymbol
                }
              >
                +
              </Text>

              <Text
                style={
                  styles.addPhotoText
                }
              >
                Add photo
              </Text>
            </Pressable>
          </ScrollView>

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
              History
            </Text>

            <Text
              style={
                styles.sectionCount
              }
            >
              {
                projectBoulders.length
              }
            </Text>
          </View>

          {projectBoulders.length ===
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
                No linked attempts
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Link a boulder to this project while logging and its attempts will appear here.
              </Text>
            </View>
          ) : (
            <View
              style={
                styles.historyList
              }
            >
              {projectBoulders.map(
                (
                  boulder,
                  index,
                ) => {
                  const session =
                    sessions.find(
                      (item) =>
                        item.id ===
                        boulder.sessionId,
                    );

                  return (
                    <Pressable
                      key={
                        boulder.id
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Edit project entry ${index + 1}`}
                      disabled={mutating}
                      onPress={() =>
                        router.push({
                          pathname:
                            '/edit-boulder',
                          params: {
                            sessionId:
                              boulder.sessionId,
                            boulderId:
                              boulder.id,
                          },
                        })
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.historyRow,
                        {
                          backgroundColor:
                            pressed
                              ? theme.surfacePressed
                              : 'transparent',
                          opacity:
                            mutating
                              ? 0.5
                              : 1,
                        },
                      ]}
                    >
                      <Text
                        style={
                          styles.historyNumber
                        }
                      >
                        {index + 1}
                      </Text>

                      <GradeBadge
                        grade={
                          boulder.grade
                        }
                        tone={
                          boulder.result ===
                            'Completed'
                            ? 'success'
                            : boulder.result ===
                                'Project'
                              ? 'warning'
                              : 'neutral'
                        }
                        scheme={scheme}
                      />

                      <View
                        style={
                          styles.historyContent
                        }
                      >
                        <Text
                          numberOfLines={
                            1
                          }
                          style={
                            styles.historyName
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
                            styles.historyMeta
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
                          {session?.gymName ??
                            'Unknown gym'}
                        </Text>

                        <Text
                          numberOfLines={
                            1
                          }
                          style={
                            styles.historyCharacteristics
                          }
                        >
                          {formatChoices(
                            boulder.holdType,
                          )}
                          {' · '}
                          {formatChoices(
                            boulder.movementType,
                          )}
                        </Text>

                        {session ? (
                          <Text
                            style={
                              styles.historyDate
                            }
                          >
                            {formatDate(
                              session.startedAt,
                            )}
                            {' · '}
                            {getDuration(
                              session.startedAt,
                              session.finishedAt,
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

          <View
            style={
              styles.projectActions
            }
          >
            {!completed ? (
              <AppButton
                label="Mark completed"
                loading={mutating}
                scheme={scheme}
                onPress={() => {
                  void markCompleted();
                }}
              />
            ) : (
              <View
                style={
                  styles.completedInfo
                }
              >
                <Text
                  style={
                    styles.completedInfoTitle
                  }
                >
                  Project completed
                </Text>

                <Text
                  style={
                    styles.completedInfoText
                  }
                >
                  {completionLockedByBoulder
                    ? 'A linked completed climb is keeping this project completed. Edit that entry to reopen it.'
                    : 'This project was completed manually and can be reopened.'}
                </Text>

                {!completionLockedByBoulder ? (
                  <AppButton
                    label="Reopen project"
                    variant="secondary"
                    loading={mutating}
                    scheme={scheme}
                    onPress={() => {
                      void reopenProject();
                    }}
                  />
                ) : null}
              </View>
            )}

            <AppButton
              label="Delete project"
              variant="destructive"
              disabled={mutating}
              scheme={scheme}
              onPress={() => {
                void confirmDelete();
              }}
            />
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={
          selectedPhoto !==
          null
        }
        animationType="fade"
        transparent={false}
        onRequestClose={() =>
          setSelectedPhoto(
            null,
          )
        }
      >
        <SafeAreaView
          style={
            styles.photoViewer
          }
        >
          <View
            style={
              styles.photoViewerHeader
            }
          >
            <Text
              style={
                styles.photoViewerTitle
              }
            >
              Project photo
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close project photo"
              onPress={() =>
                setSelectedPhoto(
                  null,
                )
              }
              style={({
                pressed,
              }) => [
                styles.photoViewerCloseButton,
                {
                  opacity:
                    pressed
                      ? 0.6
                      : 1,
                },
              ]}
            >
              <Text
                style={
                  styles.photoViewerCloseText
                }
              >
                Close
              </Text>
            </Pressable>
          </View>

          <View
            style={
              styles.photoViewerImageArea
            }
          >
            {selectedPhoto ? (
              <ProjectImage
                key={selectedPhoto.uri}
                uri={selectedPhoto.uri}
                style={
                  styles.photoViewerImage
                }
                resizeMode="contain"
              />
            ) : null}
          </View>
        </SafeAreaView>
      </Modal>
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

    identity: {
      minHeight: 76,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical:
        Spacing.sm,
      borderTopWidth:
        Stroke.default,
      borderBottomWidth:
        Stroke.default,
      borderColor:
        theme.border,
    },

    identityText: {
      flex: 1,
      minWidth: 0,
    },

    projectName: {
      color:
        theme.textPrimary,
      ...Typography.heading,
    },

    createdText: {
      color:
        theme.textMuted,
      ...Typography.caption,
      marginTop: 2,
    },

    statusText: {
      ...Typography.label,
    },

    activeStatus: {
      color:
        theme.project,
    },

    completedStatus: {
      color:
        theme.success,
    },

    metrics: {
      minHeight: 84,
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

    gradeSummary: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      borderBottomWidth:
        Stroke.default,
      borderBottomColor:
        theme.border,
    },

    gradeSummaryLabel: {
      color:
        theme.textSecondary,
      ...Typography.body,
    },

    gradeSummaryValue: {
      color:
        theme.textPrimary,
      ...Typography.metric,
      fontFamily:
        Fonts.mono,
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

    photoStrip: {
      gap: Spacing.sm,
      paddingRight:
        Spacing.md,
      paddingBottom:
        Spacing.xxs,
    },

    photoItem: {
      width: 148,
    },

    photoPreviewButton: {
      width: 148,
      height: 112,
      borderRadius:
        Radius.md,
      overflow: 'hidden',
      backgroundColor:
        theme.surfacePressed,
    },

    photo: {
      width: '100%',
      height: '100%',
      backgroundColor:
        theme.surfacePressed,
    },

    removePhotoButton: {
      minHeight: 44,
      justifyContent:
        'center',
      alignItems:
        'flex-start',
      paddingHorizontal:
        Spacing.xxs,
    },

    removePhotoText: {
      color:
        theme.danger,
      ...Typography.caption,
    },

    addPhotoButton: {
      width: 148,
      height: 112,
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

    addPhotoSymbol: {
      color:
        theme.action,
      fontSize: 28,
      lineHeight: 30,
      fontWeight: '300',
    },

    addPhotoText: {
      color:
        theme.textSecondary,
      ...Typography.caption,
      marginTop:
        Spacing.xxs,
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

    historyList: {
      borderTopWidth:
        Stroke.default,
      borderTopColor:
        theme.border,
    },

    historyRow: {
      minHeight: 94,
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

    historyNumber: {
      width: 20,
      color:
        theme.textMuted,
      ...Typography.caption,
      fontFamily:
        Fonts.mono,
      textAlign: 'center',
    },

    historyContent: {
      flex: 1,
      minWidth: 0,
    },

    historyName: {
      color:
        theme.textPrimary,
      ...Typography.bodyStrong,
    },

    historyMeta: {
      color:
        theme.textSecondary,
      ...Typography.caption,
      marginTop: 2,
    },

    historyCharacteristics: {
      color:
        theme.textMuted,
      ...Typography.caption,
      marginTop: 1,
    },

    historyDate: {
      color:
        theme.textMuted,
      ...Typography.caption,
      marginTop: 1,
    },

    photoViewer: {
      flex: 1,
      backgroundColor:
        '#000000',
    },

    photoViewerHeader: {
      minHeight: 60,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      paddingHorizontal:
        Layout.horizontalPadding,
      borderBottomWidth:
        Stroke.default,
      borderBottomColor:
        '#2A2A2A',
    },

    photoViewerTitle: {
      color:
        '#FFFFFF',
      ...Typography.subheading,
    },

    photoViewerCloseButton: {
      minWidth:
        Size.touchTarget,
      minHeight:
        Size.touchTarget,
      alignItems: 'center',
      justifyContent:
        'center',
      paddingHorizontal:
        Spacing.sm,
    },

    photoViewerCloseText: {
      color:
        '#FFFFFF',
      ...Typography.bodyStrong,
    },

    photoViewerImageArea: {
      flex: 1,
      paddingHorizontal:
        Spacing.sm,
      paddingVertical:
        Spacing.sm,
    },

    photoViewerImage: {
      width: '100%',
      height: '100%',
    },

    projectActions: {
      gap: Spacing.sm,
      marginTop:
        Spacing.xxl,
    },

    completedInfo: {
      gap: Spacing.xs,
      paddingVertical:
        Spacing.md,
      borderTopWidth:
        Stroke.default,
      borderBottomWidth:
        Stroke.default,
      borderColor:
        theme.border,
      marginBottom:
        Spacing.xs,
    },

    completedInfoTitle: {
      color:
        theme.success,
      ...Typography.subheading,
    },

    completedInfoText: {
      color:
        theme.textMuted,
      ...Typography.body,
      marginBottom:
        Spacing.xs,
    },
  });