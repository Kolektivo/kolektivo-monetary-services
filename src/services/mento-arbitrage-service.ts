import { getContract } from "../helpers/contracts-helper";
import { logMessage, serviceThrewException } from "../helpers/errors-helper";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";

const serviceName = "Mento Service";
const MENTO_BADGE_ID = 42042;

export const executeMentoService = async (kCurPrice: number, signer: DefenderRelaySigner): Promise<void> => {
  logMessage(serviceName, "executing the MentoService");

  try {
    const kGuilderPrice = 1.79;
    const kCurKGuilderRatio = 0;
    const kGuilderPool = getContract("kGuilder Pool", signer); // getContract("kGuilderPool", signer);
    const kCurContract = getContract("CuracaoReserveToken", signer);
    /**
     * how to use the badger to gain access to the mentoservice:
     * https://github.com/Kolektivo/kolektivo-governance-contracts/pull/45
     */
    // kGTokenContract.approve(mentoOracleContract, kCurContractAmountToBeTransferred);
    // kCurContract.approve(mentoOracleContract, kCurContractAmountToBeTransferred);
  } catch (ex) {
    serviceThrewException(serviceName, ex);
  }
  return await Promise.resolve();
};
