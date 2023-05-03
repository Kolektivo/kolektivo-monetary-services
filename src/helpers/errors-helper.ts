import { sendNotification } from "./notifications-helper";

interface IError {
  message: string;
  stack: string;
}

export let failedStatus = false;

export const clearFailedStatus = (): void => {
  failedStatus = false;
};

/**
 * Reports the error, does not throw an exception
 *
 * @param serviceName
 * @param message
 * @param stack
 */
const _serviceFailed = (serviceName: string, message: string, stack?: string): void => {
  failedStatus = true;
  const subject = `A Kolektivo service has failed: ${serviceName}`;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  message = `${message}\r\n${stack ?? "no stack trace available"}`;
  try {
    sendNotification(subject, message);
  } catch {
    /* empty */
  }
  /**
   * this will go to the Autotask log
   */
  logError(serviceName, message);
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

export const logError = (prefix: string, ...message: unknown[]): void => {
  // eslint-disable-next-line no-console
  console.error(`${prefix}: ${message.join(" ")}`);
};

export const logWarning = (prefix: string, ...message: unknown[]): void => {
  // eslint-disable-next-line no-console
  console.warn(`${prefix}: ${message.join(" ")}`);
};
