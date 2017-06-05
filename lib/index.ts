export function parseOption(item: AWS.EC2.Instance | AWS.EC2.Image, tagKey: string): Option | undefined {
  try {
    const option: Option = JSON.parse(item.Tags!.find(tag => tag.Key === tagKey)!.Value!);
    return option;
  } catch (e) {
    console.log(`${e.name}: Tag \`${tagKey}\`'s value cannot be parsed. ${e.message} Item: \`${JSON.stringify(item)}\``);
    throw e;
  }
}

export function sleep(msec: number): Promise<any> {
  return new Promise(resolve => setTimeout(resolve, msec));
}

export interface Option {
  NoReboot:  boolean;
  Retention: Option.Retention;
}

export namespace Option {
  export interface Retention {
    Period?: number;
    Count?:  number;
  }
}
