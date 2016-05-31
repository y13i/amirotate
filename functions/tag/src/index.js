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

  await ec2.createTags({
    Resources: instances.map(i => i.InstanceId),

    Tags: [
      {
        Key:   evt.tagKey,
        Value: JSON.stringify(evt.opts),
      },
    ],
  }).promise();

  return;
});
