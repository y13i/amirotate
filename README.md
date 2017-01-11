# amirotate

[日本語](README.ja.md)

Lambda functions to backup and rotate images of EC2 instance.

## Usage

### Set AWS credentials and region

Set environment variable `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `AWS_REGION`.

[direnv](https://github.com/direnv/direnv) is very useful for this.

Instead of setting `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`, you can write your credentials on `~/.aws/credentials` (and set `AWS_PROFILE` if it's not `[default]`).

- [Configuring the AWS Command Line Interface - AWS Command Line Interface](http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html#cli-config-files)

### Deploy Lambda Functions

Clone repo.

```sh
$ git clone https://github.com/y13i/amirotate.git
```

Install dependencies.

```sh
$ cd amirotate
$ npm install
```

Deploy.

```sh
$ npm run deploy
```

By default, the functions will be scheduled to be invoked daily at 0:00 UTC.

If you want to change the schedule, edit `cron(0 0 ? * * *)` in `serverless.yml`. See [Serverless Framework - AWS Lambda Events - Scheduled & Recurring](https://serverless.com/framework/docs/providers/aws/events/schedule/).

### Tag instances

Create a tag for the EC2 instances you want to backup like below.

| Key       | Value         |
|-----------|---------------|
| amirotate | (JSON string) |

JSON string represents the option of amirotate for the instance. The structure is...

```js
{
  "NoReboot": (true | false), // Boolean. Optional. If true, CreateImage API will called with `NoReboot` option.

  "Retention": { // Required. This option specifies retention policy for the image.
    "Count": 1, // Numeric. Optional. If present, specified number of newest images will retained.
    "Period": 180000000 // Numeric. Optional. Unit is in milliseconds. If present, the image will retained in specified time period after creation.
  }
}
```

**The value must be valid JSON**. Example below (No reboot, retain 3 images):

```json
{"NoReboot": true, "Retention": {"Count": 3}}
```

If you want to change the key of the tag from `amirotate`, simply edit `provider.environment.tagKey` in `serverless.yml`.

### Invoke functions manually

```sh
$ npm run create
```

```sh
$ npm run delete
```

### Remove functions

```sh
$ npm run remove
```

## See also

- [Serverless - The Serverless Application Framework powered by AWS Lambda and API Gateway](https://serverless.com/)

## History

- v1 - **amirotate** written in Ruby. Moved to [y13i/amirotate-rb](https://github.com/y13i/amirotate-rb)
- v2 - **amirotatejs** written in JavaScript with Apex. Moved to [branch: apex-final](https://github.com/y13i/amirotate/tree/apex-final)
- v3 - current.
