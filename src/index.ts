/**
 * the packages available in the Autotask execution environment:
 *    https://docs.openzeppelin.com/defender/autotasks#environment
 */
/* eslint-disable no-console */
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { fetchAbis, IAutoRelayHandler } from "./abi-service";
import { getTokenGeckoPrice } from "./coingecko-service";
import { INotificationClient } from "./notifications";
import { getOracleForToken, getReserveContract, updateOracle } from "./reserve-service";

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
  const cusdPrice = await getTokenGeckoPrice("celo-dollar", coinGeckoApiKey);

  // confirm here: https://www.coingecko.com/en/coins/celo-dollar
  console.log("cUSD price: ", cusdPrice);

  const reserveContract = getReserveContract(signer);

  console.log("Reserve address: ", reserveContract.address);

  const cUsdOracleContract = await getOracleForToken(reserveContract, "cUSD", signer);

  console.log("cUSD Oracle address: ", cUsdOracleContract.address);
  console.log("Updating cUSD oracle");

  /**
   * From https://www.npmjs.com/package/defender-relay-client#user-content-ethersjs :
   *
   * A wait on the transaction to be mined will only wait for the current transaction hash (see Querying).
   * If Defender Relayer replaces the transaction with a different one, this operation will time out.
   * This is ok for fast transactions, since Defender only reprices after a few minutes.
   * But if you expect the transaction to take a long time to be mined, then ethers' wait may not work.
   * Future versions will also include an ethers provider aware of this.
   */
  const tx = await updateOracle(cUsdOracleContract, cusdPrice);
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  console.log(`Update cUSD tx hash: ${tx.hash}`);
  // const mined = await tx.wait();

  // const cusdAbi = getContractAbi("cUSD");
  // const cusdAddress = getContractAddress("cUSD");

  // this actually works!
  // sendNotification(context, "Autotask notification", "Autorun has succeeded");

  return "Success";

  // const txRes = await relayer.sendTransaction({
  //   to: '0xc7464dbcA260A8faF033460622B23467Df5AEA42',
  //   value: 100,
  //   speed: 'fast',
  //   gasLimit: '21000',
  // });

  // console.log(txRes);
  // return txRes.hash;
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
