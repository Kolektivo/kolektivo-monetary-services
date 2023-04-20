/* eslint-disable no-console */

import { getContract } from "./contracts-service";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";

export const executeMentoService = async (kCurPrice: number, signer: DefenderRelaySigner): Promise<void> => {
  console.log("executing  the MentoService");

  const kGuilderPrice = 1.79;
  const kCurKGuilderRatio = 0;
  const kGuilderPool = getContract("kGuilder Pool", signer); // getContract("kGuilderPool", signer);
  return await Promise.resolve();
};
