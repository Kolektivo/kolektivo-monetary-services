// @ts-ignore
import * as ethers from "ethers";
import { BigNumber, BytesLike, Contract } from "ethers";

async function calculateRequiredkCur(
  spotPriceFinal: BigNumber,
  vaultContract: Contract,
  cUsdAddress: BytesLike,
  poolId: BytesLike
) {
  const {tokens, balances} = await vaultContract.getPoolTokens(poolId);

  const cusdIndex = tokens.indexOf(cUsdAddress);
  const kCurIndex = cusdIndex === 0 ? 1 : 0;

  const cUsdBalance = balances[cusdIndex];
  const kCurBalance = balances[kCurIndex];

  // dynamic import to prevent variable BigNumber name conflict
  const { BigNumber: BigN } = await import("bignumber.js");
  // setting configuration of Bignumber
  BigN.config({ EXPONENTIAL_AT: 10000, DECIMAL_PLACES: 10 });

  const one = new BigN("1");
  // spot price before swap
  const sp1 = new BigN(cUsdBalance.toString()).div(new BigN(kCurBalance.toString())).times(one.div(one.minus(new BigN("0.001"))));
  // target spot price
  const sp2 = new BigN(ethers.utils.formatUnits(spotPriceFinal.toString(), "ether"));
  // kCur balance of kCur<>cUSD pool
  const bk1 = new BigN(kCurBalance.toString());
  // cUSD balance of kCur<>cUSD pool
  const bc1 = new BigN(cUsdBalance.toString());
  // spot price before swap divided by spot price after swap
  // required by the formula
  const sp2BySp1 = sp2.div(sp1);

  // calculated based on formula provided here https://balancer-dao.gitbook.io/learn-about-balancer/fundamentals/white-paper/trading-formulas/in-given-price
  const amountIn = bk1.times(sp2BySp1.sqrt().minus(one));

  // calculated based on formula provided here https://docs.balancer.fi/reference/math/weighted-math.html#outgivenin
  const amountOut = bk1.times(one.minus(bc1.div(bc1.plus(amountIn))));

  // swapping on 15% of required amount to ensure the price doesn't shoot too high
  const amountOutAdjusted = amountOut.div(new BigN("1.5"));

  // converting the BigNumber.js to ethers.BigNumber
  return ethers.BigNumber.from(amountOutAdjusted.toString().split(".")[0]);
}

export default calculateRequiredkCur;
