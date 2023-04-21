import { getContract } from "./contracts-service";
import { logMessage, serviceThrewException } from "./errors-service";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";
import { Contract } from "ethers/lib/ethers";
import { formatEther } from "ethers/lib/utils";

const serviceName = "Floor and Ceiling Service";

export const executeFloorAndCeilingService = async (kCurPrice: number, signer: DefenderRelaySigner): Promise<void> => {
  logMessage(serviceName, "executing  the FloorAndCeilingService");

  try {
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
    logMessage(serviceName, `reserve floor: ${floor}`);

    //price ceiling is defined in the BL as Price Floor * Ceiling Multiplier
    //TODO get ceiling multiplier from the proxy contract when we get it
    const ceiling = floor * 1.9;
    logMessage(serviceName, `reserve ceiling: ${ceiling}`);

    const proxyContract = {} as Contract; // getContract("proxy", signer);
  } catch (ex) {
    serviceThrewException(serviceName, ex);
  }
  return await Promise.resolve();
};
