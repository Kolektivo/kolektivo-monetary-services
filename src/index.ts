/**
 * the packages available in the Autotask execution environment:
 *    https://docs.openzeppelin.com/defender/autotasks#environment
 */
/* eslint-disable no-console */
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { fetchAbis, IAutoRelayHandler } from "./abi-service";
import { getContract } from "./contracts-service";
import { executeCusdService } from "./cusd-service";
import { executeFloorAndCeilingService } from "./kcur-floor-and-ceiling-service";
import { executeKCurService, getKCurPrice } from "./kcur-service";
import { executeMentoService } from "./mento-arbitrage-service";
import { INotificationClient } from "./notifications";

import { Relayer } from "defender-relay-client";
import { DefenderRelayProvider, DefenderRelaySigner } from "defender-relay-client/lib/ethers";
import { RelayerModel } from "defender-relay-client/lib/relayer";

export const RUNNING_LOCALLY = require.main === module;

/********************************
 * Autotask entrypoint for the entire service
 *
 * The autotask logs all exceptions thrown here, including stack trace, and sends an email to the Defender account holder.
 *
 * @returns I believe can be used to trigger notifications
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function handler(event: IAutoRelayHandler, context: { notificationClient?: INotificationClient }): Promise<string> {
  fetchAbis();

  const relayer = new Relayer(event);
  const info: RelayerModel = await relayer.getRelayer();
  console.log(`Relayer address is ${info.address}`);

  const provider = new DefenderRelayProvider(event);
  const signer = new DefenderRelaySigner(event, provider, { speed: "fast" });

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const coinGeckoApiKey = RUNNING_LOCALLY ? process.env.COINGECKO_API_KEY! : event.secrets.CoingeckoApiKey;

  const kCurPool = getContract("kCUR Pool", signer);

  const kCurPrice = await getKCurPrice(kCurPool);
  console.log("kCUR price: ", kCurPrice);

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

  await Promise.all([
    executeCusdService(coinGeckoApiKey, signer),
    executeKCurService(kCurPrice, signer),
    executeMentoService(kCurPrice, kCurPool, signer),
    executeFloorAndCeilingService(kCurPrice, kCurPool, signer),
  ]);

  // this actually works!
  // sendNotification(context, "Autotask notification", "Autorun has succeeded");

  return "Success";
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
      console.error(error);
      process.exit(1);
    });
}
