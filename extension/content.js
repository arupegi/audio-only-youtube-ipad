const ext = globalThis.browser ?? globalThis.chrome;
let enabled = true;
let dataSaverEnabled = true;
let lastUrl = location.href;

function getVideoId() {
  try {
    const url = new URL(location.href);
    if (url.hostname === "youtu.be") return url.pathname.slice(1).split("/")[0];
    if (url.pathname === "/watch") return url.searchParams.get("v");
    const embed = url.pathname.match(/^\/embed\/([^/?]+)/);
    if (embed) return embed[1];
    const shorts = url.pathname.match(/^\/shorts\/([^/?]+)/);
    if (shorts) return shorts[1];
  } catch (_) {}
  return null;
}

function currentThumbnail() {
  const id = getVideoId();
  if (id && dataSaverEnabled) {
    // 高解像度画像を避け、拡張UI/オーバーレイ用には軽い320x180を使用。
    return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
  }
  const meta = document.querySelector('meta[property="og:image"]');
  if (meta?.content) return meta.content;
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

function updateOverlay() {
  document.documentElement.classList.toggle("aoyt-audio-only", enabled);

  const player = document.querySelector("#movie_player") || document.querySelector(".html5-video-player");
  if (!player) return;

  const computed = getComputedStyle(player);
  if (computed.position === "static") player.style.position = "relative";

  let overlay = player.querySelector(":scope > #aoyt-thumbnail-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "aoyt-thumbnail-overlay";
    player.prepend(overlay);
  }

  const thumb = currentThumbnail();
  if (thumb) overlay.style.backgroundImage = `url("${thumb.replace(/"/g, "%22")}")`;
}

async function loadState() {
  try {
    const result = await ext.storage.local.get(["audioOnlyEnabled", "dataSaverEnabled"]);
    enabled = result.audioOnlyEnabled ?? true;
    dataSaverEnabled = result.dataSaverEnabled ?? true;
  } catch (_) {
    enabled = true;
    dataSaverEnabled = true;
  }
  updateOverlay();
}

ext.runtime.onMessage.addListener((message) => {
  if (message?.type === "AUDIO_ONLY_STATE") {
    enabled = Boolean(message.enabled);
    updateOverlay();
  }
  if (message?.type === "DATA_SAVER_STATE") {
    dataSaverEnabled = Boolean(message.enabled);
    updateOverlay();
  }
  if (message?.type === "GET_PAGE_INFO") {
    const title = document.querySelector('meta[property="og:title"]')?.content
      || document.querySelector('meta[name="title"]')?.content
      || document.title.replace(/\s*-\s*YouTube\s*$/, "")
      || "YouTube";
    return Promise.resolve({
      url: location.href,
      title,
      thumbnail: currentThumbnail()
    });
  }
});

const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    setTimeout(updateOverlay, 250);
  }
  updateOverlay();
});

loadState();
observer.observe(document.documentElement, { subtree: true, childList: true });
window.addEventListener("yt-navigate-finish", () => setTimeout(updateOverlay, 100));
