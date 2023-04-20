import { getContractAbi, getContractAddress } from "./abi-service";
import { getContract } from "./contracts-service";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers";
import { ethers } from "ethers";
import { Contract } from "ethers/lib/ethers";
import { parseEther } from "ethers/lib/utils";

export interface ITransaction {
  hash: string;
}

export const getReserveContract = (signer: DefenderRelaySigner): Contract => {
  return getContract("Reserve", signer);
};

export const getOracleForToken = async (reserveContract: Contract, erc20Name: string, signer: DefenderRelaySigner): Promise<Contract> => {
  const erc20Address = getContractAddress(erc20Name);
  const oracleAddress = await reserveContract.oraclePerERC20(erc20Address);
  const oracleAbi = getContractAbi("Oracle");
  return new ethers.Contract(oracleAddress, oracleAbi, signer);
};

export const updateOracle = (oracleContract: Contract, price: number): Promise<ITransaction> => {
  // default precision is 18
  const formattedPrice = parseEther(price.toString());
  return oracleContract.pushReport(formattedPrice) as Promise<ITransaction>;
};
