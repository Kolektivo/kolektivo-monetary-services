import { ITransaction, KGUILDER_USDPRICE } from "../globals";
import { getContractAddress } from "../helpers/abi-helper";
import { fromWeiToNumber, getContract } from "../helpers/contracts-helper";
import { logMessage, serviceThrewException } from "../helpers/errors-helper";
import { createAllowance } from "../helpers/tokens-helper";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";
import { BigNumber } from "ethers/lib/ethers";
import { parseEther } from "ethers/lib/utils";

const serviceName = "Mento Service";
const MENTO_BADGE_ID = 420421;

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
): Promise<ITransaction> => {
  const bac = getContract("BAC", signer);

  const mentoExchange = getContract("Exchange", signer);

  // get function params for execTransactionFromModule from TransactionLike object
  const txLike = await mentoExchange.populateTransaction[buy ? "buy" : "sell"](
    relayerAddress,
    parseEther(amount.toString()),
    parseEther(amountLimit.toString()),
    gold,
  );
  const { to, data } = txLike;

  // the other required params must be provided by the caller (eg the arbitrage service)
  const operation = 0; // corresponds to `call` and is always the case for our use cases
  const badgeId = MENTO_BADGE_ID;

  // call BAC
  return bac.execTransactionFromModule(to, BigNumber.from(0), data, operation, badgeId);
};

export const executeMentoService = async (
  kCurPrice: number,
  relayerAddress: string,
  signer: DefenderRelaySigner,
): Promise<void> => {
  logMessage(serviceName, "executing...");

  try {
    const kCurContract = getContract("CuracaoReserveToken", signer);
    const kGContract = getContract("KolektivoGuilder", signer);
    const mentoReserveContract = getContract("MentoReserve", signer);
    /**
     * TODO: is safe to assume the results will not overflow Number?
     */
    const kCurTotalValueMento =
      fromWeiToNumber(await kCurContract.balanceOf(mentoReserveContract.address), 18) * kCurPrice;

    // eslint-disable-next-line prettier/prettier
    const kGTotalValueStablePool =
      fromWeiToNumber(await kGContract.totalSupply(), 18) * KGUILDER_USDPRICE; // fixed price of kG

    // const kGuilderPrice = KGUILDER_USDPRICE;
    // const kCurKGuilderRatio = 0;
    // const kGuilderPool = getContract("kGuilder Pool", signer); // getContract("kGuilderPool", signer);

    /**
     * fake buying kG
     */
    // how much kG to buy with kCUR
    const receiveAmount = 0.00001;
    // max kG to receive in return
    const maxPayAmount = 0.00001;
    /**
     * approve withdrawal from the spend account
     */
    const mentoExchangeAddress = getContractAddress("Exchange");
    /**
     * tell kCUR token to allow the MentoExchange to spend kCUR on behalf of the Relayer
     */
    await createAllowance(
      signer,
      kCurContract,
      "kCUR",
      maxPayAmount,
      relayerAddress,
      mentoExchangeAddress,
      serviceName,
    );

    const tx = await sendBuyOrSell(signer, relayerAddress, receiveAmount, maxPayAmount, false, true);

    logMessage(serviceName, `Attempted to buy ${receiveAmount} kG with max kCUR ${maxPayAmount}, tx hash: ${tx.hash}`);
  } catch (ex) {
    serviceThrewException(serviceName, ex);
  }
};
