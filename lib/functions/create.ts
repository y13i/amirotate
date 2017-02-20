import * as lambda           from 'apex.js';
import * as AWS              from 'aws-sdk';
import * as SourceMapSupport from 'source-map-support';
import * as AMIRotate        from '..';

SourceMapSupport.install();

interface CreateResult {
  instanceId: string;
  imageId:    string;
  tags:       AWS.EC2.Tag[];
}

export default lambda(async (event: any) => {
  const ec2 = new AWS.EC2();

  const tagKey = event.tagKey || process.env.tagKey;

  const instances = await (async () => {
    let instances = new Array<AWS.EC2.Instance>();
    let nextToken: string | undefined;

    do {
      const describeInstancesResult: AWS.EC2.DescribeInstancesResult = await ec2.describeInstances({
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
      }).promise();

      describeInstancesResult.Reservations!.forEach(
        reservation => instances.push(...reservation.Instances!)
      );

      nextToken = describeInstancesResult.NextToken;
    } while (nextToken);

    return instances;
  })();

  const results: CreateResult[] = await Promise.all(instances.map(async (instance, index) => {
    const instanceId = instance.InstanceId!;
    const option     = AMIRotate.parseOption(instance, tagKey)!;
    const tags       = instance.Tags!.filter(tag => !tag.Key!.match(/^aws:/));

    if (process.env.sleepBeforeEach) {
      const ms = parseInt(process.env.sleepBeforeEach, 10) * index;
      if (ms > 0) await AMIRotate.sleep(ms);
    }

    const createImageResult = await ec2.createImage({
      InstanceId: instanceId,
      Name:       `${instanceId}_${Date.now()}`,
      NoReboot:   option.NoReboot,
    }).promise();

    const imageId = createImageResult.ImageId!;

    await ec2.createTags({
      Resources: [imageId],
      Tags:      tags,
    }).promise();

    return {
      instanceId,
      imageId,
      tags,
    };
  }));

  console.log(JSON.stringify(results));

  return results;
});
