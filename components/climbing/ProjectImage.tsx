import { useState } from 'react';
import { Image, Text, View, type ImageProps } from 'react-native';
import { resolveProjectPhotoUri } from '@/features/media/media-processor';

type Props = { uri: string; style: ImageProps['style']; resizeMode: ImageProps['resizeMode'] };

export function ProjectImage({ uri, style, resizeMode }: Props) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <View style={[style, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#292929' }]}>
      <Text style={{ color: '#FFFFFF', textAlign: 'center', padding: 12 }}>Photo unavailable. You can remove it and add it again.</Text>
    </View>;
  }
  return <Image source={{ uri: resolveProjectPhotoUri(uri) }} style={style} resizeMode={resizeMode} onError={() => setFailed(true)} />;
}
