import {EC2} from 'aws-sdk';

import {Option} from './types';

export function getOption(item: EC2.Instance | EC2.Image, tagKey: string): Option {
  const tag = item.Tags!.find(tag => tag.Key === tagKey);

  if (!tag) {
    const message = `Tag \`${tagKey}\` not found.`;
    console.error(message);
    throw new Error(message);
  }

  try {
    return JSON.parse(tag.Value!);
  } catch (e) {
    console.error(`${e.name}: Tag \`${tagKey}\`'s value cannot be parsed. ${e.message} Item: \`${JSON.stringify(item)}\``);
    throw e;
  }
}

export function sleep(msec: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, msec));
}
