import { KGUILDER_USDPRICE } from "../globals";
import { getContractAbi } from "../helpers/abi-helper";
import { logMessage, serviceThrewException } from "../helpers/errors-helper";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";

const serviceName = "Mento-Oracle Service";

export const executeMentoOracleService = async (kCurPrice: number, signer: DefenderRelaySigner): Promise<void> => {
  logMessage(serviceName, "executing the mentoOracleService");

  try {
    if (kCurPrice < Number.MIN_VALUE) {
      throw new Error("kCUR price is too small");
    }
    const kGkCurExchangeRate = 1 / (KGUILDER_USDPRICE / kCurPrice);
    const mentoOracleContract = getContractAbi("SortedOracles");
  } catch (ex) {
    serviceThrewException(serviceName, ex);
    return undefined;
  }
};
