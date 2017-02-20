import * as lambda           from 'apex.js';
import * as AWS              from 'aws-sdk';
import * as SourceMapSupport from 'source-map-support';
import * as AMIRotate        from '..';

SourceMapSupport.install();

interface DeleteResult {
  imageId: string;
  reason:  string;

  snapshots: {
    snapshotId: string;
  }[];
}

interface ImageDeletionPlan {
  image:  AWS.EC2.Image;
  reason: string;
}

export default lambda(async (event: any) => {
  const ec2 = new AWS.EC2();

  const tagKey = event.tagKey || process.env.tagKey;

  const getImageInstanceId: (image: AWS.EC2.Image) => string = image => {
    try {
      return image.Name!.match(/^i-[0-9a-f]+/)![0];
    } catch (e) {
      console.log(`${e.name}: Cannot parse instance ID from ${image}. ${e.message}`);
      throw e;
    }
  };

  const getImageTimestamp: (image: AWS.EC2.Image) => number = image => {
    try {
      return parseInt(image.Name!.match(/\d+$/)![0], 10);
    } catch (e) {
      console.log(`${e.name}: Cannot parse time from ${image}. ${e.message}`);
      throw e;
    }
  };

  const images = (await ec2.describeImages({
    Owners: ['self'],

    Filters: [
      {
        Name:   'state',
        Values: ['available'],
      },

      {
        Name:   'tag-key',
        Values: [tagKey],
      }
    ],
  }).promise()).Images!;

  let imagesGroupByInstanceId: {[instanceId: string]: AWS.EC2.Image[]} = {};

  images.forEach(image => {
    const instanceId = getImageInstanceId(image);

    if (!imagesGroupByInstanceId[instanceId]) {
      imagesGroupByInstanceId[instanceId] = new Array<AWS.EC2.Image>();
    }

    imagesGroupByInstanceId[instanceId].push(image);
  });

  for (let instanceId in imagesGroupByInstanceId) {
    imagesGroupByInstanceId[instanceId].sort((a, b) =>
      getImageTimestamp(b) - getImageTimestamp(a)
    );
  }

  let imageDeletionPlans = new Array<ImageDeletionPlan>();

  images.forEach(image => {
    const option         = AMIRotate.parseOption(image, tagKey)!;
    const imageTimestamp = getImageTimestamp(image);
    const instanceId     = getImageInstanceId(image);

    if (typeof option.Retention === 'undefined') {
      return;
    }

    if (
      typeof option.Retention.Period === 'number' &&
      (imageTimestamp + option.Retention.Period) < Date.now()
    ) {
      imageDeletionPlans.push({
        image:  image,
        reason: `Retention period expired (${new Date(imageTimestamp)}).`,
      });
    } else if (
      typeof option.Retention.Count === 'number' &&
      imagesGroupByInstanceId[instanceId].length > option.Retention.Count &&
      imagesGroupByInstanceId[instanceId].indexOf(image) >= option.Retention.Count
    ) {
      imageDeletionPlans.push({
        image: image,

        reason: (
          `Retention count exceeded (retaining last ${option.Retention.Count} images` +
          ` created from \`${instanceId}\`, ${imagesGroupByInstanceId[instanceId].indexOf(image) + 1}` +
          ` out of a total of ${imagesGroupByInstanceId[instanceId].length}).`
        ),
      });
    }
  });

  const results: DeleteResult[] = await Promise.all(imageDeletionPlans.map(async (imageDeletionPlan, index) => {
    const snapshotIds = imageDeletionPlan.image.BlockDeviceMappings!.filter(bd => bd.Ebs)!.map(bd => bd.Ebs!.SnapshotId!);

    if (process.env.sleepBeforeEach) {
      const ms = parseInt(process.env.sleepBeforeEach, 10) * index;
      if (ms > 0) await AMIRotate.sleep(ms);
    }

    await ec2.deregisterImage({ImageId: imageDeletionPlan.image.ImageId!}).promise();

    if (process.env.sleepBeforeDeleteSnapshots) {
      const ms = parseInt(process.env.sleepBeforeDeleteSnapshots, 10);
      if (ms > 0) await AMIRotate.sleep(ms);
    }

    await Promise.all(snapshotIds.map(snapshotId =>
      ec2.deleteSnapshot({SnapshotId: snapshotId}).promise()
    ));

    return {
      imageId:   imageDeletionPlan.image.ImageId!,
      reason:    imageDeletionPlan.reason,
      snapshots: snapshotIds.map(snapshotId => ({snapshotId})),
    };
  }));

  console.log(JSON.stringify(results));

  return results;
});
