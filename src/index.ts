/**
 * the packages available in the Autotask execution environment:
 *    https://docs.openzeppelin.com/defender/autotasks#environment
 */
/* eslint-disable no-console */
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { fetchAbis, IAutoRelayHandler } from "./abi-service";
import { executeCusdService } from "./cusd-service";
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

  await executeCusdService(coinGeckoApiKey, signer);

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
