import { getContractAddress } from "../helpers/abi-helper";
import { getContract } from "../helpers/contracts-helper";
import { logMessage, serviceThrewException } from "../helpers/errors-helper";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";
import { formatEther, parseEther } from "ethers/lib/utils";

const serviceName = "Mento Service";
const MENTO_BADGE_ID = 42042;

/**
 * how to use the badger to gain access to the mentoservice:
 * https://github.com/Kolektivo/kolektivo-governance-contracts/pull/45
 */
const sendBuyOrSell = async (
  signer: DefenderRelaySigner,
  relayerAddress: string,
  /**
   * amount paying if selling, or amount receiving if buying
   */
  amount: number,
  /**
   * minimum amount receiving if selling, or maximum amount paying if buying
   */
  amountLimit: number,
  /**
   * In MentoExchange, gold refers to kCUR, !gold refers to kG
   * When buying: gold is to buy kCUR, !gold is to buy kG
   * When selling: gold is to sell kCUR, !gold is to sell kG
   */
  gold: boolean,
  /**
   * false to sell
   */
  buy: boolean,
): Promise<{ hash: string }> => {
  const bac = getContract("BAC", signer);

  const mentoExchange = getContract("Exchange", signer);

  // get function params for execTransactionFromModule from TransactionLike object
  const txLike = await mentoExchange.populateTransaction[buy ? "buy" : "sell"](
    relayerAddress,
    parseEther(amount.toString()),
    parseEther(amountLimit.toString()),
    gold,
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
  kGkCurExchangeRate: number | undefined,
  signer: DefenderRelaySigner,
): Promise<void> => {
  logMessage(serviceName, "executing...");

  try {
    if (!kGkCurExchangeRate) {
      throw new Error(`Cannot proceed, kCUR/kG exchange rate is undefined or zero`);
    }

    // const kGuilderPrice = KGUILDER_USDPRICE;
    // const kCurKGuilderRatio = 0;
    // const kGuilderPool = getContract("kGuilder Pool", signer); // getContract("kGuilderPool", signer);
    const kCurContract = getContract("CuracaoReserveToken", signer);
    // const kGContract = getContract("KolektivoGuilder", signer);

    /**
     * fake buying kG
     */
    // how much kG to buy with kCUR
    const receiveAmount = 0.00001;
    // max kG to receive in return
    const maxPayAmount = 0.00001;
    /**
     * aprove withdrawal from the spend account
     */
    const mentoExchangeAddress = getContractAddress("Exchange");
    /**
     * tell kCUR token to allow the MentoExchange (spender) to spend kCUR on behalf of the Relayer (owner)
     */
    const currentAllowance = Number.parseFloat(
      formatEther(await kCurContract.allowance(relayerAddress, mentoExchangeAddress)),
    );
    if (currentAllowance < maxPayAmount) {
      const tx = await kCurContract.connect(signer).approve(mentoExchangeAddress, parseEther(maxPayAmount.toString()));
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      logMessage(serviceName, `Approved max purchase of ${maxPayAmount}: ${tx.hash}`);
    }

    const tx = await sendBuyOrSell(signer, relayerAddress, receiveAmount, maxPayAmount, false, true);

    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    logMessage(serviceName, `Attempted to buy ${receiveAmount} kG with max kCUR ${maxPayAmount}, tx hash: ${tx.hash}`);
  } catch (ex) {
    serviceThrewException(serviceName, ex);
  }
};
