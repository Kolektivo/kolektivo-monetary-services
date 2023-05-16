import { BigNumber, FixedNumber } from "ethers";

const ZERO = FixedNumber.from(0);
const ONE = FixedNumber.from(1);
const TWO = FixedNumber.from(2);
const NEGATIVE_ONE = FixedNumber.from(-1);

export const pow = (inputNumber: FixedNumber, exponentNumber: number): FixedNumber => {
  // Handle special cases
  if (exponentNumber === 0) {
    return ONE;
  } else if (exponentNumber === 1) {
    return inputNumber;
  }

  let result = ONE;

  // Compute the power using repeated multiplication
  if (exponentNumber > 0) {
    for (let i = 0; i < exponentNumber; i++) {
      result = result.mulUnsafe(inputNumber);
    }
  } else {
    // Negative exponent, compute reciprocal
    const reciprocalBase = ONE.divUnsafe(inputNumber);
    for (let i = 0; i > exponentNumber; i--) {
      result = result.mulUnsafe(reciprocalBase);
    }
  }

  return result;
};

const reverseSign = (num: FixedNumber): FixedNumber => {
  return num.mulUnsafe(NEGATIVE_ONE);
};

const abs = (num: FixedNumber): FixedNumber => {
  return num.isNegative() ? reverseSign(num) : num;
};

const gt = (num1: FixedNumber, num2: FixedNumber): boolean => {
  /**
   * is num1 greater than num2
   */
  return num2.subUnsafe(num1).isNegative();
};

const lt = (num1: FixedNumber, num2: FixedNumber): boolean => {
  /**
   * is num1 less than num2
   */
  return num1.subUnsafe(num2).isNegative();
};

export const sqrt = (inputNumber: FixedNumber): FixedNumber => {
  if (inputNumber.isZero()) {
    return ZERO;
  }

  if (inputNumber.isNegative()) {
    throw new Error("attempting to compute square root of a negative number");
  }

  // Adjust the scaling factor as needed
  const scaledNumber = inputNumber.mulUnsafe(pow(FixedNumber.from("10"), 4));

  let guess = scaledNumber;

  const maxIterations = 100; // Adjust the number of iterations based on desired precision

  for (let i = 0; i < maxIterations; i++) {
    const quotient = scaledNumber.divUnsafe(guess);
    guess = guess.addUnsafe(quotient).divUnsafe(TWO);
  }

  return guess.divUnsafe(pow(FixedNumber.from("10"), 2));
};

export const toBigNumber = (fn: FixedNumber): BigNumber => {
  return BigNumber.from(fn.round(0).toFormat("fixed32x0").toString());
};
