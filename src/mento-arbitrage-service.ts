import { getContract } from "./contracts-service";
import { logMessage, serviceThrewException } from "./errors-service";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";

const serviceName = "Mento Arbitrage Service";

export const executeMentoService = async (kCurPrice: number, signer: DefenderRelaySigner): Promise<void> => {
  logMessage(serviceName, "executing  the MentoService");

  try {
    const kGuilderPrice = 1.79;
    const kCurKGuilderRatio = 0;
    const kGuilderPool = getContract("kGuilder Pool", signer); // getContract("kGuilderPool", signer);
  } catch (ex) {
    serviceThrewException(serviceName, ex);
  }
  return await Promise.resolve();
};
