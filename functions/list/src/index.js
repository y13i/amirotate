import lambda from 'apex.js';
import AWS    from 'aws-sdk';

import 'babel-polyfill';

const ec2 = new AWS.EC2();

const getInstances = async params => (
  await ec2.describeInstances(params).promise()
).Reservations.reduce(
  (acc, reservation) => acc.concat(reservation.Instances), []
);

const getImages = async params => (await ec2.describeImages(params).promise()).Images;

const buildOutput = (resources, idKey) => {
  const output = {};

  resources.forEach(resource => {
    output[resource[idKey]] = {};

    ['Name', 'amirotate'].forEach(tagKey => {
      const tag = resource.Tags.find(_tag => _tag.Key === tagKey);

      if (tag) {
        try {
          output[resource[idKey]][tagKey] = JSON.parse(tag.Value);
        } catch (e) {
          output[resource[idKey]][tagKey] = tag.Value;
        }
      }
    });
  });

  return output;
};

export default lambda(async (evt, ctx) => {
  console.log(`${ctx.functionName} has been invoked.`);

  const res = await Promise.all([
    getInstances(evt.describeInstancesParams),
    getImages(evt.describeImagesParams),
  ]);

  const instances = res[0];
  const images    = res[1];

  const output = {
    instances: buildOutput(instances, 'InstanceId'),
    images:    buildOutput(images, 'ImageId'),
  };

  return output;
});
