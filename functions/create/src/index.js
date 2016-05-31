import lambda from 'apex.js';
import AWS    from 'aws-sdk';

import 'babel-polyfill';

const ec2 = new AWS.EC2();

const getInstances = async params => (
  await ec2.describeInstances(params).promise()
).Reservations.reduce(
  (acc, reservation) => acc.concat(reservation.Instances), []
);

export default lambda(async (evt, ctx) => {
  console.log(`${ctx.functionName} has been invoked.`);

  const instances = await getInstances(evt.describeInstancesParams);
  const time      = Math.floor(Date.now() / 1000);

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

  await Promise.all(createImageResults.map((createImageResult, index) => ec2.createTags({
    Resources: [createImageResult.ImageId],
    Tags:      instances[index].Tags.filter(tag => !tag.Key.match(/^aws:/)),
  }).promise()));

  return createImageResults;
});
