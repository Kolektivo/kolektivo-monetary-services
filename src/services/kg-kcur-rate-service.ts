import { KGUILDER_USDPRICE } from "../globals";
import { getContractAddress } from "../helpers/abi-helper";
import { getContract } from "../helpers/contracts-helper";
import { logMessage, serviceThrewException } from "../helpers/errors-helper";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";
import { constants } from "ethers";
import { parseUnits } from "ethers/lib/utils";

const serviceName = "kG-kCur Rate Service";

export const executeMentoOracleService = async (kCurPrice: number, signer: DefenderRelaySigner): Promise<void> => {
  logMessage(serviceName, "executing...");

  try {
    if (kCurPrice < Number.MIN_VALUE) {
      throw new Error("kCUR price is too small");
    }
    /**
     * exchange rate, how many kG to purchase one kCUR
     */
    const kGkCurExchangeRate = 1 / (KGUILDER_USDPRICE / kCurPrice);

    const kGTokenContractAddress = getContractAddress("KolektivoGuilder");
    logMessage(serviceName, "kGuilder address: ", kGTokenContractAddress);

    const mentoOracleContract = getContract("SortedOracles", signer);
    logMessage(serviceName, "SortedOracles address: ", mentoOracleContract.address);

    logMessage(serviceName, `Reporting ${kGkCurExchangeRate} to SortedOracles`);
    /**
     * the Relayer must be registered as an "oracle" with the SortedOracles contract
     */
    const tx = await mentoOracleContract.report(
      kGTokenContractAddress,
      parseUnits(kGkCurExchangeRate.toString(), 24),
      constants.AddressZero,
      constants.AddressZero,
    );
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    logMessage(serviceName, `Updated Mento SortedOracles, tx hash: ${tx.hash}`);
  } catch (ex) {
    serviceThrewException(serviceName, ex);
    return undefined;
  }
};
