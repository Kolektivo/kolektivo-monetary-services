import { getContract } from "../helpers/contracts-helper";
import { logMessage, serviceThrewException } from "../helpers/errors-helper";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";
import { Contract } from "ethers/lib/ethers";
import { formatEther } from "ethers/lib/utils";

const serviceName = "FloorCeiling Service";

export const executeFloorAndCeilingService = async (kCurPrice: number, signer: DefenderRelaySigner): Promise<void> => {
  logMessage(serviceName, "executing the FloorAndCeilingService");

  try {
    /**
     * 1.79 Guilder is hardcoded to 1 $USD
     * one kG meant to be pegged to 1 Guilder, one-to-one
     * balance of kCUR in Mento Reserve is meant to be fixed to the totalSupply of kGuilder
     */
    const reserveContract = getContract("Reserve", signer);
    const kCurContract = getContract("CuracaoReserveToken", signer);

    //price floor is defined in the BL as Reserve Value / kCUR Supply
    const reserveValue = Number.parseFloat(formatEther((await reserveContract.reserveStatus())[0]));
    const kCurTotalSupply = Number.parseFloat(formatEther(await kCurContract.totalSupply()));

    if (!kCurTotalSupply) {
      throw new Error("kCur totalSupply is zero");
    }
    const floor = reserveValue / kCurTotalSupply;
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
