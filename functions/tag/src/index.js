import lambda from 'apex.js';
import AWS    from 'aws-sdk';

import 'babel-polyfill';

export default lambda(async (evt, ctx) => {
  console.log(`${ctx.functionName} has been invoked.`);

  const region = evt.region || process.env.AWS_REGION;
  const ec2    = new AWS.EC2({region});

  const instances = (
    await ec2.describeInstances(evt.describeInstancesParams).promise()
  ).Reservations.reduce(
    (acc, reservation) => acc.concat(reservation.Instances), []
  );

  const createTagsResults = await ec2.createTags({
    Resources: instances.map(i => i.InstanceId),

    Tags: [
      {
        Key:   evt.tagKey,
        Value: JSON.stringify(evt.opts),
      },
    ],
  }).promise();

  return {createTagsResults};
});
