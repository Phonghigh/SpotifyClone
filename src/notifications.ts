console.log('[DIAG 10] notifications.ts loading');
import { Platform } from 'react-native';
import Constants from 'expo-constants';

type ExpoNotifications = typeof import('expo-notifications');

let initialized = false;
let permitted = false;
let notificationsModule: ExpoNotifications | null = null;

const isAndroidExpoGo =
  Platform.OS === 'android' &&
  Constants.executionEnvironment === 'storeClient';

/**
 * Lazily load expo-notifications.
 * Returns null on Android Expo Go because remote notifications
 * are not supported there from SDK 53 onward.
 */
async function getNotificationsModule(): Promise<ExpoNotifications | null> {
  if (isAndroidExpoGo) {
    return null;
  }

  notificationsModule ??= await import('expo-notifications');
  return notificationsModule;
}

/**
 * One-time notification setup.
 * Safe to call multiple times.
 */
export async function initNotifications(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const Notifications = await getNotificationsModule();

  if (!Notifications) {
    return;
  }

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('downloads', {
        name: 'Downloads',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existing = await Notifications.getPermissionsAsync();

    if (existing.granted) {
      permitted = true;
    } else if (existing.canAskAgain) {
      const result = await Notifications.requestPermissionsAsync();
      permitted = result.granted;
    }
  } catch (err) {
    console.warn('Notifications unavailable:', err);
  }
}

/**
 * Schedule a local notification indicating a download has completed.
 * Best effort only; failures are ignored.
 */
export async function notifyDownloadComplete(
  title: string,
  body: string
): Promise<void> {
  if (!permitted) {
    return;
  }

  const Notifications = await getNotificationsModule();

  if (!Notifications) {
    return;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('Failed to schedule notification:', err);
  }
}