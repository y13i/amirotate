import 'source-map-support/register';

import * as λ from '@y13i/apex.js';
import retryx from 'retryx';
import {EC2} from 'aws-sdk';

import {parseOption, sleep} from '..';

interface CreateResult {
  instanceId: string;
  imageId:    string;
  tags:       EC2.Tag[];
}

export default λ(async (event: any) => {
  const ec2 = new EC2();

  const tagKey = event.tagKey || process.env.tagKey;

  const instances = await (async () => {
    let instances = new Array<EC2.Instance>();
    let nextToken: string | undefined;

    do {
      const describeInstancesResult = await retryx(() => ec2.describeInstances({
        NextToken: nextToken,

        Filters: [
          {
            Name: 'instance-state-name',

            Values: [
              'running',
              'stopping',
              'stopped',
            ],
          },

          {
            Name:   'tag-key',
            Values: [tagKey],
          },
        ]
      }).promise());

      describeInstancesResult.Reservations!.forEach(
        reservation => instances.push(...reservation.Instances!)
      );

      nextToken = describeInstancesResult.NextToken;
    } while (nextToken);

    return instances;
  })();

  console.log(JSON.stringify({instances}));

  const results: CreateResult[] = await Promise.all(instances.map(async (instance, index) => {
    const instanceId = instance.InstanceId!;
    const option     = parseOption(instance, tagKey)!;
    const tags       = instance.Tags!.filter(tag => !tag.Key!.match(/^aws:/));

    if (process.env.sleepBeforeEach) {
      const ms = parseInt(process.env.sleepBeforeEach, 10) * index;
      if (ms > 0) await sleep(ms);
    }

    const createImageResult = await retryx(() => ec2.createImage({
      InstanceId: instanceId,
      Name:       `${instanceId}_${Date.now()}`,
      NoReboot:   option.NoReboot,
    }).promise());

    const imageId = createImageResult.ImageId!;

    await retryx(() => ec2.createTags({
      Resources: [imageId],
      Tags:      tags,
    }).promise());

    return {
      instanceId,
      imageId,
      tags,
    };
  }));

  console.log(JSON.stringify({results}));

  return results;
});
