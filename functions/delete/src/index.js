import lambda from 'apex.js';
import AWS    from 'aws-sdk';

import 'babel-polyfill';

export default lambda(async (evt, ctx) => {
  console.log(`${ctx.functionName} has been invoked.`);

  const time   = Math.floor(Date.now() / 1000);
  const region = evt.region || process.env.AWS_REGION;
  const ec2    = new AWS.EC2({region});
  const images = (await ec2.describeImages(evt.describeImagesParams).promise()).Images;

  const imagesToDelete = images.filter(image => {
    const rotateOpts = JSON.parse(image.Tags.find(tag =>
      tag.Key === evt.describeImagesParams.Filters.find(f =>
        f.Name === 'tag-key'
      ).Values[0]).Value
    );

    const expireAt = parseInt(image.Name.match(/\d+$/)[0], 10) + rotateOpts.retention_period;

    return time > expireAt;
  });

  const snapshotIdsToDelete = imagesToDelete.reduce((acc, image) =>
    acc.concat(image.BlockDeviceMappings.filter(bd => bd.Ebs).reduce(
      (_acc, bd) => _acc.concat(bd.Ebs.SnapshotId), []
    )), []
  );

  const deregisterImageResults = await Promise.all(imagesToDelete.map(image =>
    ec2.deregisterImage({ImageId: image.ImageId}).promise()
  ));

  const deleteSnapshotResults = await Promise.all(snapshotIdsToDelete.map(snapshotId =>
    ec2.deleteSnapshot({SnapshotId: snapshotId}).promise()
  ));

  return {deregisterImageResults, deleteSnapshotResults};
});
