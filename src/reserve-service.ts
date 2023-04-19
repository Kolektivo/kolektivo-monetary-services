import { getContractAbi, getContractAddress } from "./abi-service";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers";
import { ethers } from "ethers";
import { Contract } from "ethers/lib/ethers";

export const getReserveContract = (signer: DefenderRelaySigner): Contract => {
  const reserveAddress = getContractAddress("Reserve");
  const reserveAbi = getContractAbi("Reserve");
  return new ethers.Contract(reserveAddress, reserveAbi, signer);
};

export const getOracleForToken = async (reserveContract: Contract, erc20Name: string, signer: DefenderRelaySigner): Promise<Contract> => {
  const erc20Address = getContractAddress(erc20Name);
  const oracleAddress = await reserveContract.oraclePerERC20(erc20Address);
  const oracleAbi = getContractAbi("Oracle");
  return new ethers.Contract(oracleAddress, oracleAbi, signer);
};

export const updateOracle = (oracleContract: Contract, price: number): Promise<void> => {
  // default precision is 18
  const formattedPrice = ethers.utils.parseEther(price.toString());
  return oracleContract.pushReport(formattedPrice);
};
