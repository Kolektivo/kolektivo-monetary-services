import { ITransaction } from "../globals";

import { getContract } from "./contracts-helper";
import { logMessage } from "./errors-helper";
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

  const cUsdContract = getContract("cUSD", signer);
  balance = Number.parseFloat(formatEther(await cUsdContract.balanceOf(owner)));

  if (balance < MIN_TOKENBALANCE) {
    reportShortfall(balance, "cUSD");
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
  tokenContractName: string,
  maxPayAmount: number,
  relayerAddress: string, // always the owner
  spender: string,
  serviceName: string,
): Promise<void> => {
  const relayerBalance = Number.parseFloat(formatEther(await tokenContract.balanceOf(relayerAddress)));

  if (relayerBalance < maxPayAmount) {
    throw new Error("Relayer is lacking the sufficient funds to pay ${maxPayAmount} of ${tokenContractName}");
  }

  let tx: ITransaction | undefined;
  const currentAllowance = Number.parseFloat(formatEther(await tokenContract.allowance(relayerAddress, spender)));
  if (currentAllowance < maxPayAmount) {
    /**
     * The Relayer will always be the owner (msg.sender)
     */
    tx = await tokenContract.approve(spender, parseEther(maxPayAmount.toString()));
  }
  logMessage(
    serviceName,
    `Approved max purchase of ${maxPayAmount} of ${tokenContractName}, tx hash: ${tx?.hash ?? "no tx needed"}`,
  );
};
