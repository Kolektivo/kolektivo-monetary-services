/* eslint-disable no-console */
import { getTokenGeckoPrice } from "./coingecko-service";
import { serviceThrewException } from "./errors-service";
import { getOracleForToken, getReserveContract, updateOracle } from "./reserve-service";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";

export const executeCusdService = async (
  coinGeckoApiKey: string,
  signer: DefenderRelaySigner,
): Promise<number | undefined> => {
  console.log("executing the cUsdService");

  let cusdPrice!: number;

  try {
    cusdPrice = await getTokenGeckoPrice("celo-dollar", coinGeckoApiKey);
  } catch (ex) {
    serviceThrewException("cUSD Price Service", ex);
    return undefined;
  }

  try {
    // confirm here: https://www.coingecko.com/en/coins/celo-dollar
    console.log("cUSD price: ", cusdPrice);

    const reserveContract = getReserveContract(signer);

    console.log("Reserve address: ", reserveContract.address);

    const cUsdOracleContract = await getOracleForToken(reserveContract, "cUSD", signer);

    console.log("cUSD Oracle address: ", cUsdOracleContract.address);
    console.log("Updating cUSD oracle");

    const txcUsd = await updateOracle(cUsdOracleContract, cusdPrice);
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    console.log(`Updated cUSD oracle tx hash: ${txcUsd.hash}`);
    // const mined = await tx.wait();
  } catch (ex) {
    serviceThrewException("cUSD Price Service", ex);
    /**
     * we will continue on to at least return the value of cusdPrice, allowing other services to continue
     */
  }

  return cusdPrice;
};
