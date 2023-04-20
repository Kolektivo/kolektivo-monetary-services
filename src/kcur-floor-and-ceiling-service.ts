/* eslint-disable no-console */

import { getContract } from "./contracts-service";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";
import { Contract } from "ethers/lib/ethers";
import { formatEther } from "ethers/lib/utils";

export const executeFloorAndCeilingService = async (kCurPrice: number, signer: DefenderRelaySigner): Promise<void> => {
  console.log("executing  the FloorAndCeilingService");

  const kGuilderPrice = 1.79;

  const reserveContract = getContract("Reserve", signer);
  const kCurContract = getContract("kCur", signer);

  //price floor is defined in the BL as Reserve Value / kCUR Supply
  const reserveValue = Number.parseFloat(formatEther((await reserveContract.reserveStatus())[0]));
  const kCurSupplyValue = Number.parseFloat(formatEther(await kCurContract.totalSupply())) * kCurPrice;

  if (!kCurSupplyValue) {
    throw new Error("kCur totalSupply is zero");
  }
  const floor = reserveValue / kCurSupplyValue;
  console.log(`reserve floor: ${floor}`);

  //price ceiling is defined in the BL as Price Floor * Ceiling Multiplier
  //TODO get ceiling multiplier from the proxy contract when we get it
  const ceiling = floor * 1.9;
  console.log(`reserve ceiling: ${ceiling}`);

  const proxyContract = {} as Contract; // getContract("proxy", signer);
  return await Promise.resolve();
};
