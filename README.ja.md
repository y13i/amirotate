# amirotate

AMI (Amazon Machine Image) による EC2 インスタンスのバックアップと世代管理を行う Lambda Function 群です。

## 前提条件

- [Node.js](https://nodejs.org/)

## 使い方

### AWS 認証情報とリージョンをセットする

環境変数 `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` をセットしてください。

[direnv](https://github.com/direnv/direnv) を使うと便利です。

`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` をセットする代わりに、認証情報を `~/.aws/credentials` に書くこともできます。（もしそれが `[default]` プロファイル以外なら `AWS_PROFILE` 環境変数もセットしてください）

- [Configuring the AWS Command Line Interface - AWS Command Line Interface](http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html#cli-config-files)

### Lambda Functions をデプロイする

このリポジトリーをクローンします。

```sh
$ git clone https://github.com/y13i/amirotate.git
```

依存物をインストールします。

```sh
$ cd amirotate

$ yarn
# or
$ npm install
```

デプロイします。

```sh
$ yarn run deploy
# or
$ npm run deploy
```

デフォルトでは `create` は 0:00 UTC 、 `delete` は 1:00 UTC に毎日実行されるようにスケジューリングされます。

もし変更したい場合は、 `serverless.yml` の `cron(0 0 ? * * *)` の部分を [Serverless Framework - AWS Lambda Events - Scheduled & Recurring](https://serverless.com/framework/docs/providers/aws/events/schedule/) を参考に変更してください。

### インスタンスにタグをつける

以下のように、バックアップ対象のインスタンスにタグを追加します。

| Key               | Value         |
|-------------------|---------------|
| amirotate:default | (JSON 文字列) |

JSON 文字列は各インスタンスごとの設定を表します。その構造は以下の通りです。

```js
{
  "NoReboot": (true | false), // 真偽値。もし true の場合は CreateImage API が NoReboot オプション付きで呼ばれます。

  "Retention": { // 必須。作成したイメージを保持するポリシーを決定します。
    "Count": 1, // 数値。もし指定された場合、その個数の最新イメージのみを保持します。
    "Period": 180000000 // 数値。もし指定された場合、作成からその時間はイメージを保持します。単位はミリ秒です。
  }
}
```

**Value は 正しい JSON でなくてはいけません。** 以下は例 (No reboot, 3つのイメージを残す)

```json
{"NoReboot": true, "Retention": {"Count": 3}}
```

タグのキーを `amirotate:default` から変えたい場合、 `serverless.yml` の `provider.environment.tagKey` の値を `amirotate:<your alternate name here>` の形式で変更してください。

#### 複数の周期バックアップを設定する場合

`serverless.yml` の `functions.<create|delete>.events` に複数の `schedule` を設定することで可能です。その際は `tagKey` も異なる値を設定します。例えば

```yaml
functions:
  create:
    handler: lambda/create.default
    events:
    - schedule:
        rate: cron(0 0 ? * * *)
        input:
          tagKey: amirotate:daily
    - schedule:
        rate: cron(0 1 ? * SUN *)
        input:
          tagKey: amirotate:weekly
  delete:
    handler: lambda/delete.default
    events:
    - schedule:
        rate: cron(0 2 ? * * *)
        input:
          tagKey: amirotate:daily
    - schedule:
        rate: cron(0 3 ? * SUN *)
        input:
          tagKey: amirotate:weekly
```

### function を手動実行する

```sh
$ yarn run create
# or
$ npm run create
```

```sh
$ yarn run delete
# or
$ npm run delete
```

`tagKey` の値を手動実行時に切り替えたい場合は…

```sh
$ echo '{"tagKey": "amirotate:daily"}' | yarn run create
# or
$ echo '{"tagKey": "amirotate:daily"}' | npm run create
```

### function を削除する

```sh
$ yarn run remove
# or
$ npm run remove
```

## 参考

- [Serverless - The Serverless Application Framework powered by AWS Lambda and API Gateway](https://serverless.com/)
