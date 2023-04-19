export interface ISendNotification {
  channelAlias: string;
  subject: string;
  message: string;
}
export interface INotificationClient {
  send: (params: ISendNotification) => void;
}

/**
 * Send a notification to the given channel (see Defender Notification Channels)
 * @param message
 * @param context is an argument to the handler
 */
export const sendNotification = (context: { notificationClient?: INotificationClient }, message: string, subject: string, channel = "Kolektivo Notifications") => {
  const { notificationClient } = context;
  // is not set when running locally
  if (notificationClient) {
    try {
      notificationClient.send({
        channelAlias: channel,
        subject: subject,
        message: message,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (ex: any) {
      throw new Error("Failed to send notification", ex.message);
    }
  }
};
