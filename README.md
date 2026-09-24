# Audio Only YouTube for iPad — Codemagic build (v0.7)

Safari Web Extension source intended for Codemagic -> unsigned IPA -> AltStore/iLoader signing.

## v0.7 changes

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
