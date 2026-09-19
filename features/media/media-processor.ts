import * as FileSystem from 'expo-file-system/legacy';
import type { ImagePickerAsset } from 'expo-image-picker';
import type { ProjectPhoto } from '@/domain/models';
import { createId } from '@/utils/id';

const MEDIA_DIRECTORY = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}crux/project-media/`
  : null;

function extensionFor(asset: ImagePickerAsset): string {
  const fileName = asset.fileName?.trim();
  const fileExtension = fileName?.match(/\.([a-zA-Z0-9]{2,5})$/)?.[1];
  if (fileExtension) return fileExtension.toLowerCase();
  const mimeExtension = asset.mimeType?.split('/')[1]?.replace('jpeg', 'jpg');
  return mimeExtension && /^[a-zA-Z0-9]+$/.test(mimeExtension) ? mimeExtension : 'jpg';
}

// iOS can relocate the app container across installs/updates. Resolve only
// CRUX-owned media filenames against the current documents directory.
export function resolveProjectPhotoUri(uri: string): string {
  const name = uri.match(/^file:.*\/crux\/project-media\/([a-zA-Z0-9_-]+\.[a-zA-Z0-9]+)$/)?.[1];
  return MEDIA_DIRECTORY && name ? `${MEDIA_DIRECTORY}${name}` : uri;
}

export async function persistProjectPhoto(asset: ImagePickerAsset): Promise<ProjectPhoto> {
  const id = createId('photo');
  let uri = asset.uri;

  if (MEDIA_DIRECTORY) {
    await FileSystem.makeDirectoryAsync(MEDIA_DIRECTORY, { intermediates: true });
    const destination = `${MEDIA_DIRECTORY}${id}.${extensionFor(asset)}`;
    await FileSystem.copyAsync({ from: asset.uri, to: destination });
    uri = destination;
  }

  let sizeBytes = asset.fileSize;
  if (!sizeBytes && MEDIA_DIRECTORY) {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && typeof info.size === 'number' && info.size > 0) sizeBytes = info.size;
  }

  return {
    id,
    uri,
    createdAt: new Date().toISOString(),
    sanitized: false,
    width: asset.width > 0 ? asset.width : undefined,
    height: asset.height > 0 ? asset.height : undefined,
    mimeType: asset.mimeType?.trim() || undefined,
    sizeBytes: sizeBytes && sizeBytes > 0 ? sizeBytes : undefined,
  };
}

export async function removePersistedProjectPhoto(photo: ProjectPhoto): Promise<void> {
  const uri = resolveProjectPhotoUri(photo.uri);
  if (!MEDIA_DIRECTORY || !uri.startsWith(MEDIA_DIRECTORY)) return;
  const name = uri.slice(MEDIA_DIRECTORY.length);
  if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(name)) return;
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

export function supportsDurableProjectMedia(): boolean {
  return MEDIA_DIRECTORY !== null;
}
