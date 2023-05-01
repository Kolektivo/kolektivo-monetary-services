import { getTokenGeckoPrice } from "../helpers/coingecko-helper";
import { logMessage, serviceThrewException } from "../helpers/errors-helper";
import { getOracleForToken, getReserveContract, updateOracle } from "../helpers/reserve-helper";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";

const serviceName = "cUSD Service";

export const executeCusdService = async (
  coinGeckoApiKey: string,
  signer: DefenderRelaySigner,
): Promise<number | undefined> => {
  logMessage(serviceName, "executing the cUsdService");

  let cusdPrice!: number;

  try {
    cusdPrice = await getTokenGeckoPrice("celo-dollar", coinGeckoApiKey);
  } catch (ex) {
    serviceThrewException(serviceName, ex);
    return undefined;
  }

  try {
    // confirm here: https://www.coingecko.com/en/coins/celo-dollar
    const reserveContract = getReserveContract(signer);

    logMessage(serviceName, "Reserve address: ", reserveContract.address);

    const cUsdOracleContract = await getOracleForToken(reserveContract, "cUSD", signer);

    logMessage(serviceName, "cUSD Oracle address: ", cUsdOracleContract.address);
    logMessage(serviceName, `Reporting ${cusdPrice} to cUSD Oracle`);

    const txcUsd = await updateOracle(cUsdOracleContract, cusdPrice);
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    logMessage(serviceName, `Updated cUSD Oracle, tx hash: ${txcUsd.hash}`);
    // const mined = await tx.wait();
  } catch (ex) {
    serviceThrewException(serviceName, ex);
    /**
     * we will continue on to at least return the value of cusdPrice, allowing other services to continue
     */
  }

  return cusdPrice;
};
