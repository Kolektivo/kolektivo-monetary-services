import { logMessage, serviceThrewException } from "../helpers/errors-service";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";

const serviceName = "Mento-Oracle Service";

export const executeMentoOracleService = async (kcurPrice: number, signer: DefenderRelaySigner): Promise<void> => {
  logMessage(serviceName, "executing the mentoOracleService");

  try {
  } catch (ex) {
    serviceThrewException(serviceName, ex);
    return undefined;
  }
};
