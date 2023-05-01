import { getContract } from "../helpers/contracts-helper";
import { logMessage, serviceThrewException } from "../helpers/errors-helper";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";

const serviceName = "Mento Service";
const MENTO_BADGE_ID = 42042;

/**
 * how to use the badger to gain access to the mentoservice:
 * https://github.com/Kolektivo/kolektivo-governance-contracts/pull/45
 */
const sentBacTransaction = async (signer: DefenderRelaySigner): Promise<void> => {
  const bac = getContract("BAC", signer);

  // target function params (for buy function on MentoExchange)
  const from = "own_address_of_arb_service";
  const buyAmount = 123;
  const maxSellAmount = 456;
  const buyGold = true;

  const mentoExchange = getContract("MentoExchange", signer);

  // get function params for execTransactionFromModule from TransactionLike object
  const txLike = await mentoExchange.populateTransaction.buy(from, buyAmount, maxSellAmount, buyGold);
  const { to, value, data } = txLike;

  // the other required params must be provided by the caller (eg the arbitrage service)
  const operation = 0; // corresponds to `call` and is always the case for our use cases
  const badgeId = MENTO_BADGE_ID;

  // call BAC
  const tx = await bac.execTransactionFromModule(to, value, data, operation, badgeId);
};

export const executeMentoService = async (kCurPrice: number, signer: DefenderRelaySigner): Promise<void> => {
  logMessage(serviceName, "executing the MentoService");

  try {
    const kGuilderPrice = 1.79;
    const kCurKGuilderRatio = 0;
    const kGuilderPool = getContract("kGuilder Pool", signer); // getContract("kGuilderPool", signer);
    const kCurContract = getContract("CuracaoReserveToken", signer);
    // kGTokenContract.approve(mentoOracleContract, kCurContractAmountToBeTransferred);
    // kCurContract.approve(mentoOracleContract, kCurContractAmountToBeTransferred);
  } catch (ex) {
    serviceThrewException(serviceName, ex);
  }
  return await Promise.resolve();
};
