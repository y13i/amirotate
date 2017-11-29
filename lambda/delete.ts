import 'source-map-support/register';

import dalamb from 'dalamb';
import retryx from 'retryx';
import {EC2} from 'aws-sdk';

import {getOption, sleep} from '../lib/utils';
import {AMIRotateEvent, DeleteResult, ImageDeletionPlan, InstanceIdImagesMap} from '../lib/types';

export default dalamb<AMIRotateEvent>(async (event: any) => {
  const ec2 = new EC2();

  const tagKey: string = event.tagKey || process.env.tagKey || 'amirotate:default';

  const images = await getImages(ec2, tagKey);

  console.log(JSON.stringify({images}));

  const instanceIdImagesMap = groupImagesByInstanceId(...images);

  console.log(JSON.stringify({instanceIdImagesMap}));

  const imageDeletionPlans = getImageDeletionPlans(instanceIdImagesMap, tagKey);

  console.log(JSON.stringify({imageDeletionPlans}));

  const deleteResults = await deleteImages(ec2, ...imageDeletionPlans);

  console.log(JSON.stringify({deleteResults}));

  return deleteResults;
});

function getImageInstanceId(image: EC2.Image): string {
  try {
    return image.Name!.match(/^i-[0-9a-f]+/)![0];
  } catch (e) {
    console.log(`${e.name}: Cannot parse instance ID from ${image}. ${e.message}`);
    throw e;
  }
}

function getImageTimestamp(image: EC2.Image): number {
  try {
    return parseInt(image.Name!.match(/\d+$/)![0], 10);
  } catch (e) {
    console.log(`${e.name}: Cannot parse time from ${image}. ${e.message}`);
    throw e;
  }
}

async function getImages(ec2: EC2, tagKey: string): Promise<EC2.Image[]> {
  const describeImagesResult = await retryx(() => ec2.describeImages({
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
  }).promise());

  return describeImagesResult.Images!;
}

function groupImagesByInstanceId(...images: EC2.Image[]): InstanceIdImagesMap {
  const result: InstanceIdImagesMap = {};

  images.forEach(image => {
    const instanceId = getImageInstanceId(image);

    if (!result[instanceId]) {
      result[instanceId] = [];
    }

    result[instanceId].push(image);
  });

  for (let instanceId in result) {
    // newest first.
    result[instanceId].sort((a, b) => getImageTimestamp(b) - getImageTimestamp(a));
  }

  return result;
}

function getImageDeletionPlans(instanceIdImagesMap: InstanceIdImagesMap, tagKey: string): ImageDeletionPlan[] {
  const result: ImageDeletionPlan[] = [];

  Object.keys(instanceIdImagesMap).forEach(instanceId => {
    const images = instanceIdImagesMap[instanceId];

    images.forEach(image => {
      const option         = getOption(image, tagKey)!;
      const imageTimestamp = getImageTimestamp(image);

      if (!option.Retention) {
        return;
      }

      if (
        typeof option.Retention.Period === 'number' &&
        (imageTimestamp + option.Retention.Period) < Date.now()
      ) {
        result.push({
          image:  image,
          reason: `Retention period expired (${new Date(imageTimestamp)}).`,
        });
      } else if (
        typeof option.Retention.Count === 'number' &&
        images.length > option.Retention.Count &&
        images.indexOf(image) >= option.Retention.Count
      ) {
        result.push({
          image: image,

          reason: (
            `Retention count exceeded (retaining last ${option.Retention.Count} images` +
            ` created from \`${instanceId}\`, ${images.indexOf(image) + 1}` +
            ` out of a total of ${images.length}).`
          ),
        });
      }
    });
  });

  return result;
}

async function deleteImages(ec2: EC2, ...imageDeletionPlans: ImageDeletionPlan[]): Promise<DeleteResult[]> {
  return await Promise.all(imageDeletionPlans.map(async (imageDeletionPlan, index) => {
    const snapshotIds = imageDeletionPlan.image.BlockDeviceMappings!.filter(bd => bd.Ebs)!.map(bd => bd.Ebs!.SnapshotId!);

    if (process.env.sleepBeforeEach) {
      const ms = parseInt(process.env.sleepBeforeEach, 10) * index;
      if (ms > 0) await sleep(ms);
    }

    await retryx(() => ec2.deregisterImage({ImageId: imageDeletionPlan.image.ImageId!}).promise());

    if (process.env.sleepBeforeDeleteSnapshots) {
      const ms = parseInt(process.env.sleepBeforeDeleteSnapshots, 10);
      if (ms > 0) await sleep(ms);
    }

    await Promise.all(snapshotIds.map(snapshotId =>
      retryx(() => ec2.deleteSnapshot({SnapshotId: snapshotId}).promise())
    ));

    return {
      imageId:   imageDeletionPlan.image.ImageId!,
      reason:    imageDeletionPlan.reason,
      snapshots: snapshotIds.map(snapshotId => ({snapshotId})),
    };
  }));
}
