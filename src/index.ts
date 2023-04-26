/**
 * the packages available in the Autotask execution environment:
 *    https://docs.openzeppelin.com/defender/autotasks#environment
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { fetchAbis, IAutoRelayHandler } from "./helpers/abi-service";
import { failedStatus, logMessage, logWarning } from "./helpers/errors-service";
import { initializeNotifications, INotificationClient } from "./helpers/notifications-service";
import { executeCusdService } from "./services/cusd-service";
import { executeFloorAndCeilingService } from "./services/kcur-floor-and-ceiling-service";
import { executeKCurService, getKCurPrice } from "./services/kcur-service";
import { executeMentoService } from "./services/mento-arbitrage-service";
import { executeMentoOracleService } from "./services/mento-oracle-service";

import { Relayer } from "defender-relay-client";
import { DefenderRelayProvider, DefenderRelaySigner } from "defender-relay-client/lib/ethers";
import { RelayerModel } from "defender-relay-client/lib/relayer";

export const RUNNING_LOCALLY = require.main === module;
const serviceName = "Handler";

export interface IRunContext {
  notificationClient?: INotificationClient;
}

/********************************
 * Autotask entrypoint for the entire service
 *
 * The autotask logs all exceptions thrown here, including stack trace, and sends an email to the Defender account holder.
 *
 * @returns I believe can be used to trigger notifications
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function handler(event: IAutoRelayHandler, context?: IRunContext): Promise<string> {
  initializeNotifications(context?.notificationClient);

  fetchAbis();

  const relayer = new Relayer(event);
  const info: RelayerModel = await relayer.getRelayer();
  logMessage(serviceName, `Relayer address is ${info.address}`);

  const provider = new DefenderRelayProvider(event);
  const signer = new DefenderRelaySigner(event, provider, { speed: "fast" });

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const coinGeckoApiKey = RUNNING_LOCALLY ? process.env.COINGECKO_API_KEY! : event.secrets.CoingeckoApiKey;

  /**
   * FYI we aren't awaiting transactions to be mined.  Why, aside from the fact that Celo is fast
   * and we're asking in the signer for fast mining:
   *
   * From https://www.npmjs.com/package/defender-relay-client#user-content-ethersjs :
   *
   * A wait on the transaction to be mined will only wait for the current transaction hash (see Querying).
   * If Defender Relayer replaces the transaction with a different one, this operation will time out.
   * This is ok for fast transactions, since Defender only reprices after a few minutes.
   * But if you expect the transaction to take a long time to be mined, then ethers' wait may not work.
   * Future versions will also include an ethers provider aware of this.
   */

  let cusdPrice = await executeCusdService(coinGeckoApiKey, signer);

  if (cusdPrice == undefined) {
    cusdPrice = 1; // good enough and doesn't fail the other service
    logWarning(serviceName, "Due to an error, defaulting cusdPrice to 1");
  }

  const kCurPrice = await getKCurPrice(cusdPrice, signer);

  if (kCurPrice === undefined) {
    throw new Error("Cannot proceed, all services depend on the kCur price, which could not be obtained");
  }

  await Promise.all([
    executeKCurService(kCurPrice, signer),
    executeMentoOracleService(kCurPrice, signer),
    executeMentoService(kCurPrice, signer),
    executeFloorAndCeilingService(kCurPrice, signer),
  ]);

  if (failedStatus) {
    throw new Error("One or more services failed");
  } else {
    return "Succeeded";
  }
}

/*************************************
 * To run locally (this code will not be executed in Autotasks)
 */
// Sample typescript type definitions
type EnvInfo = {
  API_KEY: string;
  API_SECRET: string;
};

if (RUNNING_LOCALLY) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("dotenv").config();
  const { API_KEY: apiKey, API_SECRET: apiSecret } = process.env as EnvInfo;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition

  handler({ apiKey, apiSecret, secrets: {} }, { notificationClient: undefined })
    .then(() => process.exit(0))
    .catch((error: Error) => {
      // eslint-disable-next-line no-console
      console.error(error);
      process.exit(1);
    });
}
