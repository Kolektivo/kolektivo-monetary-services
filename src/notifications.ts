import { logMessage } from "./errors-service";

export interface ISendNotification {
  channelAlias: string;
  subject: string;
  message: string;
}
export interface INotificationClient {
  send: (params: ISendNotification) => void;
}

let notificationsClient: INotificationClient | undefined;

export const initializeNotifications = (client?: INotificationClient) => {
  notificationsClient = client;
};

/**
 * Send a notification to the given channel (see Defender Notification Channels)
 * @param message
 * @param context is an argument to the handler
 */
export const sendNotification = (subject: string, message: string, channel = "Kolektivo Notifications") => {
  // is not set when running locally
  if (notificationsClient) {
    try {
      notificationsClient.send({
        channelAlias: channel,
        subject: subject,
        message: message,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (ex: any) {
      logMessage("Notifications Service", `failed sending a notification ${subject} : ${message}`);
      throw new Error("Failed to send notification", ex.message);
    }
  }
};
