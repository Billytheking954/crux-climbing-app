import {
    Alert,
    Platform,
} from 'react-native';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

export function showMessage(
  title: string,
  message: string,
): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(
        `${title}\n\n${message}`,
      );
    }

    return;
  }

  Alert.alert(
    title,
    message,
  );
}

export function confirmAction({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') {
      return Promise.resolve(false);
    }

    return Promise.resolve(
      window.confirm(
        `${title}\n\n${message}`,
      ),
    );
  }

  return new Promise(
    (resolve) => {
      Alert.alert(
        title,
        message,
        [
          {
            text: cancelText,
            style: 'cancel',
            onPress: () =>
              resolve(false),
          },
          {
            text: confirmText,
            style: destructive
              ? 'destructive'
              : 'default',
            onPress: () =>
              resolve(true),
          },
        ],
        {
          cancelable: true,
          onDismiss: () =>
            resolve(false),
        },
      );
    },
  );
}