import { getContractAbi, getContractAddress } from "./abi-service";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";
import { Contract, ethers } from "ethers";

export const getContract = (contractName: string, signer: DefenderRelaySigner): Contract => {
  const address = getContractAddress(contractName);
  const abi = getContractAbi(contractName);
  return new ethers.Contract(address, abi, signer);
};
