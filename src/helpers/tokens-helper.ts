import { getContract } from "./contracts-helper";
import { sendNotification } from "./notifications-helper";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers";
import { formatEther, parseEther } from "ethers/lib/utils";

const MIN_TOKENBALANCE = 50;

const reportShortfall = (balance: number, tokenName: string): void => {
  const message = `Relayer token balances: ${tokenName} (${balance}) has fallen below the minimum value of ${MIN_TOKENBALANCE}`;
  // eslint-disable-next-line no-console
  console.warn(message);
  sendNotification("Insufficient funds for Kolektivo Service", message);
};

export const confirmTokenBalances = async (owner: string, signer: DefenderRelaySigner): Promise<void> => {
  const kCurContract = getContract("CuracaoReserveToken", signer);

  let balance = Number.parseFloat(formatEther(await kCurContract.balanceOf(owner)));

  if (balance < MIN_TOKENBALANCE) {
    reportShortfall(balance, "kCUR");
  }

  const kGuilderContract = getContract("KolektivoGuilder", signer);
  balance = Number.parseFloat(formatEther(await kGuilderContract.balanceOf(owner)));
  if (balance < MIN_TOKENBALANCE) {
    reportShortfall(balance, "KolektivoGuilder");
  }
};

/**
 * Tell token to allow the spender to spend the token on behalf of the owner,
 * but only if the allowance is needed.
 */
export const createAllowance = async (
  signer: DefenderRelaySigner,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tokenContract: any,
  maxPayAmount: number,
  owner: string,
  spender: string,
): Promise<void> => {
  const currentAllowance = Number.parseFloat(formatEther(await tokenContract.allowance(owner, spender)));
  if (currentAllowance < maxPayAmount) {
    await tokenContract.connect(signer).approve(spender, parseEther(maxPayAmount.toString()));
  }
  // logMessage("Create token allowance", `Approved max purchase of ${maxPayAmount}: ${tx?.hash ?? "no tx needed"}`);
};
