import { INotificationClient, sendNotification } from "./notifications";

interface IError {
  message: string;
  stack: string;
}

let notificationsClient: INotificationClient | undefined;
export let failedStatus = false;

export const initializeErrorHandler = (client?: INotificationClient) => {
  notificationsClient = client;
};

const _serviceFailed = (serviceName: string, message: string, stack?: string): void => {
  failedStatus = true;
  const subject = `A Kolektivo service has failed: ${serviceName}`;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  message = `${message}\r\n${stack ?? "no stack trace available"}`;
  try {
    if (notificationsClient) {
      sendNotification(notificationsClient, subject, message);
    }
  } catch {
    /* empty */
  }
  /**
   * this will go to the Autotask log
   */
  logMessage(serviceName, message);
};

export const serviceFailed = (serviceName: string, message: string): void => {
  _serviceFailed(serviceName, message, Error().stack);
};

export const serviceThrewException = (serviceName: string, ex: unknown): void => {
  const error = ex as IError;
  _serviceFailed(serviceName, error.message, error.stack);
};

export const logMessage = (prefix: string, ...message: unknown[]): void => {
  // eslint-disable-next-line no-console
  console.log(`${prefix}: ${message.join(" ")}`);
};
