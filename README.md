# Audio Only YouTube for iPad — Codemagic build (v0.8)

Safari Web Extension source intended for Codemagic -> unsigned IPA -> AltStore/iLoader signing.

## v0.8 changes

- Strict network-layer blocking for YouTube video streams.
- Blocks explicit `mime=video` Googlevideo requests.
- Blocks known muxed/video-only YouTube itags, including fallback formats.
- Applies while using the normal player, YouTube miniplayer, and Picture in Picture.
- Keeps audio-only itags available.
- Keeps the current video's lightweight thumbnail available.
- Blocks seek/storyboard images, unrelated thumbnails and live chat traffic in Data Saver mode.
- Hides comments and recommendation surfaces.

## PiP note

Native Safari/iPadOS Picture in Picture is built around a video element. With strict video blocking enabled, PiP may show a black/frozen/poster image while audio continues. The extension intentionally prefers zero video-media transfer over restoring moving video in PiP.

## Important limitation

The extension blocks currently identifiable YouTube video-media request patterns at Safari's extension request-filter layer. YouTube can change endpoints, query formats, or delivery mechanisms in the future. Therefore no extension can truthfully guarantee that every future byte YouTube may classify as video will always be blocked without updates. The current rules are intentionally strict: if YouTube falls back to a muxed audio+video format, that request is blocked rather than allowing the video data through.

## Update GitHub

```powershell
git add .
git commit -m "Strictly block video in miniplayer and PiP"
git push
```

Codemagic can then rebuild the unsigned IPA from `codemagic.yaml`.


## v0.8 changes
- Audio-only mode disables native Picture in Picture and forces Safari video presentation back to inline, preventing native PiP from rendering buffered video frames.
- Adds an approximate traffic meter (total/audio/images/other) using response Content-Length when Safari exposes it.
- Adds a small live traffic badge on the YouTube player and a detailed card in the extension popup.


## v0.9 - 通信量CSVエクスポート

通信量カードに「CSV出力」ボタンを追加しました。iPadでは対応している場合は共有シートを開き、「ファイルに保存」からCSVを保存できます。共有シートが使えない環境では通常のダウンロードを試します。

CSVには export日時、動画タイトル、URL、合計/音声/画像/その他/映像のバイト数、観測レスポンス数、カウンター更新日時を含みます。Excelで日本語が文字化けしにくいようUTF-8 BOM付きです。
