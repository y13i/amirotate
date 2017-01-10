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

export default lambda(async () => {
  const ec2 = new AWS.EC2();

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

  const sleep: (msec: number, val?: any) => Promise<number> = (msec, val) => {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(val);
      }, msec);
    });
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
        Values: [process.env.tagKey],
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
    const option         = AMIRotate.parseOption(image, process.env.tagKey)!;
    const imageTimestamp = getImageTimestamp(image);
    const instanceId     = getImageInstanceId(image);

    if (option.Retention.Period && (imageTimestamp + option.Retention.Period) < Date.now()) {
      imageDeletionPlans.push({
        image:  image,
        reason: `Retention period expired (${new Date(imageTimestamp)}).`,
      });
    } else if (
      option.Retention.Count &&
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

  const results: DeleteResult[] = await Promise.all(imageDeletionPlans.map(async imageDeletionPlan => {
    await ec2.deregisterImage({ImageId: imageDeletionPlan.image.ImageId!}).promise();
    await sleep(500);

    const snapshotIds = imageDeletionPlan.image.BlockDeviceMappings!.filter(bd => bd.Ebs)!.map(bd => bd.Ebs!.SnapshotId!);

    await Promise.all(snapshotIds.map(snapshotId =>
      ec2.deleteSnapshot({SnapshotId: snapshotId}).promise()
    ));

    return {
      imageId:   imageDeletionPlan.image.ImageId!,
      reason:    imageDeletionPlan.reason,
      snapshots: snapshotIds.map(snapshotId => ({snapshotId: snapshotId})),
    };
  }));

  console.log(JSON.stringify(results));

  return results;
});
