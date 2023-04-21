/* eslint-disable no-console */

import { getContract } from "./contracts-service";
import { serviceThrewException } from "./errors-service";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";

export const executeMentoService = async (kCurPrice: number, signer: DefenderRelaySigner): Promise<void> => {
  console.log("executing  the MentoService");

  try {
    const kGuilderPrice = 1.79;
    const kCurKGuilderRatio = 0;
    const kGuilderPool = getContract("kGuilder Pool", signer); // getContract("kGuilderPool", signer);
    throw new Error("Something went wrong");
  } catch (ex) {
    serviceThrewException("Mento Arbitrage Service", ex);
  }
  return await Promise.resolve();
};
