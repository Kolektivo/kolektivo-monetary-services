import { fromWei, fromWeiToNumber, getContract, ITransaction, TransactionReceipt } from "./contracts-helper";
import { logMessage } from "./errors-helper";
import { sendNotification } from "./notifications-helper";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers";
import { BigNumber, BigNumberish } from "ethers/lib/ethers";

const MIN_TOKENBALANCE = 50;

export interface IErc20Token {
  address: string;
  allowance(owner: string, spender: string): Promise<BigNumber>;
  approve(spender: string, amount: BigNumberish): Promise<ITransaction>; // boolean
  balanceOf(account: string): Promise<BigNumber>;
  totalSupply(): Promise<BigNumber>;
  transfer(recipient: string, amount: BigNumberish): Promise<ITransaction>; // boolean
  transferFrom(sender: string, recipient: string, amount: BigNumberish): Promise<ITransaction>; // boolean
}

const reportShortfall = (balance: number, tokenName: string): void => {
  const message = `Relayer token balances: ${tokenName} (${balance}) has fallen below the minimum value of ${MIN_TOKENBALANCE}`;
  // eslint-disable-next-line no-console
  console.warn(message);
  sendNotification("Insufficient funds for Kolektivo Service", message);
};

export const confirmTokenBalances = async (owner: string, signer: DefenderRelaySigner): Promise<void> => {
  const kCurContract = getContract("CuracaoReserveToken", signer);

  let balance = fromWeiToNumber(await kCurContract.balanceOf(owner), 18);

  if (balance < MIN_TOKENBALANCE) {
    reportShortfall(balance, "kCUR");
  }

  const kGuilderContract = getContract("KolektivoGuilder", signer);
  balance = fromWeiToNumber(await kGuilderContract.balanceOf(owner), 18);

  if (balance < MIN_TOKENBALANCE) {
    reportShortfall(balance, "KolektivoGuilder");
  }

  const cUsdContract = getContract("cUSD", signer);
  balance = fromWeiToNumber(await cUsdContract.balanceOf(owner), 18);

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
  maxPayAmount: BigNumber,
  relayerAddress: string, // always the owner
  spenderAddress: string,
  serviceName: string,
): Promise<TransactionReceipt | undefined> => {
  const relayerBalance = await tokenContract.balanceOf(relayerAddress);

  if (relayerBalance.lt(maxPayAmount)) {
    throw new Error(
      `Relayer is lacking the sufficient funds to pay ${maxPayAmount.toString()} of ${tokenContractName}`,
    );
  }

  let tx: ITransaction | undefined;
  const currentAllowance = await tokenContract.allowance(relayerAddress, spenderAddress);
  if (currentAllowance.lt(maxPayAmount)) {
    /**
     * The Relayer will always be the owner (msg.sender)
     */
    tx = (await tokenContract.approve(spenderAddress, maxPayAmount)) as ITransaction;

    /**
     * see this: https://www.npmjs.com/package/defender-relay-client,
     * the "Limitations" section under "ethers.js"
     *
     * the caller will want this to be mined before relying on the resulting allowance
     */
    return tx.wait(2);
  }
  logMessage(
    serviceName,
    `Set allowance of ${fromWei(
      maxPayAmount,
      18,
    )} of ${tokenContractName} from Relayer to ${spenderAddress}, tx hash: ${tx?.hash ?? "no tx needed"}`,
  );
};
