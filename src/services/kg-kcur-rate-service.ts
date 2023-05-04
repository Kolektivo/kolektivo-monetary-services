import { ITransaction, KGUILDER_USDPRICE } from "../globals";
import { getContractAddress } from "../helpers/abi-helper";
import { getContract, toWei } from "../helpers/contracts-helper";
import { logMessage, serviceThrewException } from "../helpers/errors-helper";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";
import { constants } from "ethers";

const serviceName = "kG-kCur Rate Service";

export const executekGkCURService = async (
  kCurPrice: number,
  signer: DefenderRelaySigner,
): Promise<number | undefined> => {
  let kGkCurExchangeRate!: number;

  logMessage(serviceName, "executing...");

  try {
    if (kCurPrice < Number.MIN_VALUE) {
      throw new Error("kCUR price is too small");
    }
    /**
     * An exchange rate: how many kG needed to purchase one kCUR.
     * Value of kG is fixed to KGUILDER_USDPRICE.
     */
    kGkCurExchangeRate = Math.ceil(1 / (KGUILDER_USDPRICE / kCurPrice));

    const kGTokenContractAddress = getContractAddress("KolektivoGuilder");
    logMessage(serviceName, "kGuilder address: ", kGTokenContractAddress);

    const mentoOracleContract = getContract("SortedOracles", signer);
    logMessage(serviceName, "SortedOracles address: ", mentoOracleContract.address);

    logMessage(serviceName, `Reporting ${kGkCurExchangeRate} to SortedOracles`);
    /**
     * the Relayer must be registered as an "oracle" with the SortedOracles contract
     */
    const tx: ITransaction = await mentoOracleContract.report(
      kGTokenContractAddress,
      toWei(kGkCurExchangeRate, 24),
      constants.AddressZero,
      constants.AddressZero,
    );
    logMessage(serviceName, `Updated Mento SortedOracles, tx hash: ${tx.hash}`);
    return kGkCurExchangeRate;
  } catch (ex) {
    serviceThrewException(serviceName, ex);
    return undefined;
  }
};
