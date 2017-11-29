import 'source-map-support/register';

import dalamb from 'dalamb';
import retryx from 'retryx';
import {EC2} from 'aws-sdk';

import {getOption, sleep} from '../lib/utils';
import {AMIRotateEvent, CreateResult} from '../lib/types';

export default dalamb<AMIRotateEvent>(async event => {
  const ec2 = new EC2();

  const tagKey: string = event.tagKey || process.env.tagKey || 'amirotate:default';

  const instances = await getInstances(ec2, tagKey);

  console.log(JSON.stringify({instances}));

  const createResults = await createImages(ec2, tagKey, ...instances);

  console.log(JSON.stringify({createResults}));

  return createResults;
});

async function getInstances(ec2: EC2, tagKey: string): Promise<EC2.Instance[]> {
    const instances: EC2.Instance[] = [];

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
}

async function createImages(ec2: EC2, tagKey: string, ...instances: EC2.Instance[]): Promise<CreateResult[]> {
  return await Promise.all(instances.map(async (instance, index) => {
    const instanceId = instance.InstanceId!;
    const option     = getOption(instance, tagKey)!;

    const tags = instance.Tags!.filter(tag => {
      if (tag.Key!.startsWith('aws:')) {
        return false;
      }

      if (tag.Key! !== tagKey && tag.Key!.startsWith('amirotate:')) {
        return false;
      }

      return true;
    });

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
}
