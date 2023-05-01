import { parseEther } from "ethers/lib/utils";
import { KGUILDER_USDPRICE } from "../globals";
import { getContract } from "../helpers/contracts-helper";
import { logMessage, serviceThrewException } from "../helpers/errors-helper";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";

const serviceName = "Mento Service";
const MENTO_BADGE_ID = 42042;

/**
 * how to use the badger to gain access to the mentoservice:
 * https://github.com/Kolektivo/kolektivo-governance-contracts/pull/45
 */
const sendBacBuy = async (
  signer: DefenderRelaySigner,
  relayerAddress: string,
  buyAmount: number,
  maxSellAmount: number,
  buyGold: boolean,
): Promise<{ hash: string }> => {
  const bac = getContract("BAC", signer);

  const mentoExchange = getContract("MentoExchange", signer);

  // get function params for execTransactionFromModule from TransactionLike object
  const txLike = await mentoExchange.populateTransaction.buy(
    relayerAddress,
    parseEther(buyAmount.toString()),
    parseEther(maxSellAmount.toString()),
    buyGold,
  );
  const { to, value, data } = txLike;

  // the other required params must be provided by the caller (eg the arbitrage service)
  const operation = 0; // corresponds to `call` and is always the case for our use cases
  const badgeId = MENTO_BADGE_ID;

  // call BAC
  return bac.execTransactionFromModule(to, value, data, operation, badgeId);
};

export const executeMentoService = async (
  kCurPrice: number,
  relayerAddress: string,
  signer: DefenderRelaySigner,
): Promise<void> => {
  logMessage(serviceName, "executing...");

  try {
    // const kGuilderPrice = KGUILDER_USDPRICE;
    // const kCurKGuilderRatio = 0;
    // const kGuilderPool = getContract("kGuilder Pool", signer); // getContract("kGuilderPool", signer);
    // const kCurContract = getContract("CuracaoReserveToken", signer);

    // how much to buy
    const buyAmount = 0.00001;
    // max to get in return
    const maxSellAmount = 0.00001;
    // kGTokenContract.approve(mentoOracleContract, kCurContractAmountToBeTransferred);
    // kCurContract.approve(mentoOracleContract, kCurContractAmountToBeTransferred);

    const tx = await sendBacBuy(signer, relayerAddress, buyAmount, maxSellAmount, false);

    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    logMessage(serviceName, `Executed Mento Arbitrage, tx hash: ${tx.hash}`);

  } catch (ex) {
    serviceThrewException(serviceName, ex);
  }
  return await Promise.resolve();
};
