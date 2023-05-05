export const KGUILDER_USDPRICE = 0.5586592178770949; // $USD price of one kG

let _RUNNING_LOCALLY = false;

class Environment {
  public get runningLocally(): boolean {
    return _RUNNING_LOCALLY;
  }
  public set runningLocally(value: boolean) {
    _RUNNING_LOCALLY = value;
  }
}

export const environment = new Environment();

export interface ITransaction {
  hash: string;
}
