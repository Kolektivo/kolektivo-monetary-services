import { getTokenGeckoPrice } from "../helpers/coingecko-helper";
import { ITransaction } from "../helpers/contracts-helper";
import { logMessage, serviceThrewException } from "../helpers/errors-helper";
import { getOracleForToken, getReserveContract, updateOracle } from "../helpers/reserve-helper";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";

const serviceName = "cUSD Service";

export const executeCusdService = async (
  coinGeckoApiKey: string,
  signer: DefenderRelaySigner,
): Promise<number | undefined> => {
  logMessage(serviceName, "executing...");

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

    const tx: ITransaction = await updateOracle(cUsdOracleContract, cusdPrice);
    await tx.wait(2); // await because other services depend on this being up-to-date
    logMessage(serviceName, `Updated cUSD Oracle, tx hash: ${tx.hash}`);
    return cusdPrice;
  } catch (ex) {
    serviceThrewException(serviceName, ex);
    return undefined;
  }
};
