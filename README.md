# X Video Speed

A small Chrome/Brave extension that adds a speed button to every video on X. Only exists because playback options disappeared from the web UI.

![Playback speed menu on an X video](./screenshot.png)

Available speeds:

- 1
- 1.25
- 1.33
- 1.5
- 2

The selected speed applies to current and newly loaded videos. The extension remembers it after Brave restarts.

## Install in Brave

1. Open `brave://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select the `x-video-speed-controls` folder.
5. Reload any open X tabs.

The extension only runs on `x.com`. Its sole permission stores the selected speed locally.
