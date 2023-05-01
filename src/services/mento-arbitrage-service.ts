import { formatEther, parseEther } from "ethers/lib/utils";
import { KGUILDER_USDPRICE } from "../globals";
import { getContract } from "../helpers/contracts-helper";
import { logMessage, serviceThrewException } from "../helpers/errors-helper";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";
import { getContractAddress } from "../helpers/abi-helper";

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
  /**
   * gold is kCUR, !gold is kG
   */
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
    const kCurContract = getContract("CuracaoReserveToken", signer);
    // const kGContract = getContract("KolektivoGuilder", signer);

    /**
     * fake buying kG
     */
    // how much kG to buy
    const buyAmount = 0.00001;
    // max to kCUR to get in return
    const maxSellAmount = 0.00001;
    /**
     * aprove withdrawal from the spend account
     */
    const mentoExchangeAddress = getContractAddress("MentoExchange");
    /**
     * tell kCUR token to allow the MentoExchange (spender) to spend kCUR on behalf of the Relayer (owner)
     */
    const currentAllowance = Number.parseFloat(
      formatEther(await kCurContract.allowance(relayerAddress, mentoExchangeAddress)),
    );
    if (currentAllowance < maxSellAmount) {
      const tx = await kCurContract.connect(signer).approve(mentoExchangeAddress, parseEther(maxSellAmount.toString()));
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      logMessage(serviceName, `Approved max purchase of ${maxSellAmount}: ${tx.hash}`);
    }

    const tx = await sendBacBuy(signer, relayerAddress, buyAmount, maxSellAmount, false);

    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    logMessage(serviceName, `Attempted to buy ${buyAmount} kG with max kCUR ${maxSellAmount}, tx hash: ${tx.hash}`);

  } catch (ex) {
    serviceThrewException(serviceName, ex);
  }
  return await Promise.resolve();
};
