# Audio Only YouTube for iPad - Codemagic / AltStore build

このリポジトリは、Safari Web Extension のソースから Codemagic の macOS runner 上で iOS 用 Xcode プロジェクトを生成し、AltStore/AltServer で再署名するための unsigned IPA を作ります。

## 構成

- `extension/` Safari Web Extension 本体
- `codemagic.yaml` Codemagic ビルド設定
- `scripts/push_to_github.ps1` Windows から GitHub へ初回 push する補助スクリプト

Xcode プロジェクト自体は GitHub に保存せず、Codemagic のビルド時に Apple の `safari-web-extension-packager` で毎回生成します。

## 1. GitHub に空リポジトリを作る

GitHub で新しいリポジトリを作成します。README / .gitignore / License は GitHub 側では追加せず、空の状態にしてください。

例: `audio-only-youtube-ipad`

## 2. Windows から push

PowerShell でこのフォルダを開き、次を実行します。

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\push_to_github.ps1 -RepoUrl "https://github.com/YOUR_NAME/audio-only-youtube-ipad.git"
```

GitHub の認証画面が出た場合は案内に従ってログインします。

## 3. Codemagic に接続

1. Codemagic に GitHub でログイン
2. Add application
3. GitHub を選択
4. 作成したリポジトリを選択
5. `codemagic.yaml` を使用する設定で追加
6. `ios-unsigned-altstore` workflow を実行

`main` ブランチへの push でも自動ビルドされます。

## 4. IPA を取得

ビルド成功後、Codemagic の Artifacts から次をダウンロードします。

`AudioOnlyYouTube-unsigned.ipa`

これは未署名の IPA です。iPad に直接インストールするものではありません。

## 5. Windows + AltStore で署名

Windows の AltServer / AltStore からこの IPA を選択し、自分の Apple ID で署名して iPad にインストールします。

無料 Apple ID では署名の有効期間が短いため、AltServer を常駐させて定期的に Refresh します。

## Bundle ID

Codemagic では現在、コンテナアプリの Bundle ID を次に設定しています。

`com.audioonlyyoutube.ipad`

変更したい場合は `codemagic.yaml` の `BUNDLE_ID` を変更してください。

## 注意

この workflow は App Store 用の署名を行いません。Codemagic 側に Apple Developer Program の証明書を登録する必要はありません。実機へのインストール時の署名は AltStore 側で行う想定です。
