/* eslint-disable no-console */

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";
import { Contract } from "ethers/lib/ethers";

export const executeFloorAndCeilingService = async (kCurPrice: number, signer: DefenderRelaySigner): Promise<void> => {
  const kGuilderPrice = 1.79;
  const floor = 0;
  const ceiling = 0;
  const proxyContract = {} as Contract; // getContract("proxy", signer);
  return await Promise.resolve();
};
