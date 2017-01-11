# amirotate

AMI (Amazon Machine Image) による EC2 インスタンスのバックアップと世代管理を行う Lambda Function 群です。

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
$ npm install
```

デプロイします。

```sh
$ npm run deploy
```

デフォルトでは、0:00 UTCに毎日実行されるようにスケジューリングされます。

もし変更したい場合は、 `serverless.yml` の `cron(0 0 ? * * *)` の部分を [Serverless Framework - AWS Lambda Events - Scheduled & Recurring](https://serverless.com/framework/docs/providers/aws/events/schedule/) を参考に変更してください。

### インスタンスにタグをつける

以下のように、バックアップ対象のインスタンスにタグを追加します。

| Key       | Value         |
|-----------|---------------|
| amirotate | (JSON 文字列) |

JSON 文字列は各インスタンスごとの設定を表します。その構造は

```js
{
  "NoReboot": (true | false), // 真偽値。もし true の場合は CreateImage API が NoReboot オプション付きで呼ばれます。

  "Retention": { // 必須。作成したイメージを保持するポリシーを決定します。
    "Count": 1, // 数値。もし指定された場合、その個数の最新イメージのみを保持します。
    "Period": 180000000 // 数値。もし指定された場合、作成からその時間はイメージを保持します。単位はミリ秒です。
  }
}
```

**Value は 正しい JSON でなくてはいけません。**. 以下は例 (No reboot, 3つのイメージを残す):

```json
{"NoReboot": true, "Retention": {"Count": 3}}
```

タグのキーを `amirotate` から変えたい場合、 `serverless.yml` の `provider.environment.tagKey` の値を変更してください。

### function を手動実行する

```sh
$ npm run create
```

```sh
$ npm run delete
```

### function を削除する

```sh
$ npm run remove
```

## 参考

- [Serverless - The Serverless Application Framework powered by AWS Lambda and API Gateway](https://serverless.com/)
