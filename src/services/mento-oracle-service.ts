import { KGUILDER_USDPRICE } from "../globals";
import { getContractAddress } from "../helpers/abi-helper";
import { getContract } from "../helpers/contracts-helper";
import { logMessage, serviceThrewException } from "../helpers/errors-helper";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";
import { parseUnits } from "ethers/lib/utils";

const serviceName = "Mento-Oracle Service";

export const executeMentoOracleService = async (kCurPrice: number, signer: DefenderRelaySigner): Promise<void> => {
  logMessage(serviceName, "executing the mentoOracleService");

  try {
    if (kCurPrice < Number.MIN_VALUE) {
      throw new Error("kCUR price is too small");
    }
    const kGkCurExchangeRate = 1 / (KGUILDER_USDPRICE / kCurPrice);
    const kGTokenContractAddress = getContractAddress("KGuilder");

    const mentoOracleContract = getContract("SortedOracles", signer);

    mentoOracleContract.report(
      kGTokenContractAddress,
      parseUnits(kGkCurExchangeRate.toString(), 24),
      undefined,
      undefined,
    );
  } catch (ex) {
    serviceThrewException(serviceName, ex);
    return undefined;
  }
};
