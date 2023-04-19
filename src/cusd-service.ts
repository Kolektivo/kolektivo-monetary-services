/* eslint-disable no-console */
import { getTokenGeckoPrice } from "./coingecko-service";
import { getOracleForToken, getReserveContract, updateOracle } from "./reserve-service";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";

export const executeCusdService = async (coinGeckoApiKey: string, signer: DefenderRelaySigner): Promise<void> => {
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
  console.log(`Update cUSD oracle tx hash: ${tx.hash}`);
  // const mined = await tx.wait();
};
