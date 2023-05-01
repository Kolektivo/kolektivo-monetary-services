import { getContractAddress } from "./abi-helper";
import { getContract } from "./contracts-helper";
import { sendNotification } from "./notifications-helper";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers";
import { formatEther } from "ethers/lib/utils";

const MIN_TOKENBALANCE = 50;

const reportShortfall = (balance: number, tokenName: string): void => {
  const message = `The Relayer balance of ${tokenName}, ${balance}, has fallen below the minimum value of ${MIN_TOKENBALANCE}`;
  // eslint-disable-next-line no-console
  console.warn(message);
  sendNotification("Insufficient funds for Kolektivo Service", message);
};

export const confirmTokenBalances = async (signer: DefenderRelaySigner): Promise<void> => {
  const reserveContractAddress = getContractAddress("Reserve");
  const kCurContract = getContract("CuracaoReserveToken", signer);

  const balance = Number.parseFloat(formatEther(await kCurContract.balanceOf(reserveContractAddress)));

  if (balance < MIN_TOKENBALANCE) {
    reportShortfall(balance, "kCUR");
  }

  // TODO: pull this in when the token is available
  //const kGuilderContract = getContract("KolektivoGuilder");
  // balance = Number.parseFloat(formatEther(await kGuilderContract.balanceOf(reserveContractAddress)));
  if (balance < MIN_TOKENBALANCE) {
    reportShortfall(balance, "kGuilder");
  }
};
