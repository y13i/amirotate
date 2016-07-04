import lambda from 'apex.js';
import AWS    from 'aws-sdk';

import 'babel-polyfill';

export default lambda(async (evt, ctx) => {
  console.log(`${ctx.functionName} has been invoked.`);

  const time   = Math.floor(Date.now() / 1000);
  const region = evt.region || process.env.AWS_REGION;
  const ec2    = new AWS.EC2({region});

  const instances = (
    await ec2.describeInstances(evt.describeInstancesParams).promise()
  ).Reservations.reduce(
    (acc, reservation) => acc.concat(reservation.Instances), []
  );

  const createImageResults = await Promise.all(instances.map(instance => {
    const rotateOpts = JSON.parse(instance.Tags.find(tag =>
      tag.Key === evt.describeInstancesParams.Filters.find(f =>
        f.Name === 'tag-key'
      ).Values[0]).Value
    );

    return ec2.createImage({
      InstanceId: instance.InstanceId,
      Name:       `${instance.InstanceId}_${time}`,
      NoReboot:   (rotateOpts.no_reboot || false),
    }).promise();
  }));

  const createTagsResults = await Promise.all(
    createImageResults.map((createImageResult, index) => ec2.createTags({
      Resources: [createImageResult.ImageId],
      Tags:      instances[index].Tags.filter(tag => !tag.Key.match(/^aws:/)),
    }).promise())
  );

  return {createImageResults, createTagsResults};
});
