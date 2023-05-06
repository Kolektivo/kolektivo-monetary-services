import { getContractAbi, getContractAddress } from "./abi-helper";

import { TransactionReceipt, TransactionResponse } from "@ethersproject/providers";
import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";
import { BigNumber, BigNumberish, Contract, ethers } from "ethers";
import { formatUnits, parseUnits } from "ethers/lib/utils";

export interface ITransaction extends TransactionResponse {
  transactionId: string; // Defender transaction identifier
}

export { TransactionReceipt };

export const getContract = (contractName: string, signer: DefenderRelaySigner): Contract => {
  const address = getContractAddress(contractName);
  const abi = getContractAbi(contractName);
  return new ethers.Contract(address, abi, signer);
};

/**
 * remove precision from the decimals part.  Need this because toFixed adds phantom numbers with decimals > 16
 * @param num
 * @returns
 */
export const truncateDecimals = (num: number | undefined | null, decimals: number): number | undefined | null => {
  if (num === undefined || num === null || Number.isInteger(num) || isNaN(num)) {
    return num;
  }
  const parts = num.toString().split(".");
  return Number(`${parts[0]}.${parts[1].slice(0, decimals)}`);
};

/**
 * @param ethValue
 * @param decimals Can be a number or:
 *  "wei",
 *  "kwei",
 *  "mwei",
 *  "gwei",
 *  "szabo",
 *  "finney",
 *  "ether",
 * @returns
 */
export const toWei = (ethValue: BigNumberish, decimals: string | number): BigNumber => {
  const t = typeof ethValue;
  if (t === "string" || t === "number") {
    // avoid underflows
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    ethValue = truncateDecimals(Number(ethValue), Number(decimals))!;
  }
  return parseUnits(ethValue.toString(), decimals);
};

/**
 * @param weiValue
 * @param decimals Can be a number or:
 *  "wei",
 *  "kwei",
 *  "mwei",
 *  "gwei",
 *  "szabo",
 *  "finney",
 *  "ether",
 * @returns
 */
export const fromWei = (weiValue: BigNumberish, decimals: string | number): string => {
  return formatUnits(weiValue.toString(), decimals);
};

export const fromWeiToNumber = (weiValue: BigNumberish, decimals: string | number): number => {
  return Number.parseFloat(fromWei(weiValue, decimals));
};
