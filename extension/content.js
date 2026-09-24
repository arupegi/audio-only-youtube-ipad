const ext = globalThis.browser ?? globalThis.chrome;
let enabled = true;
let dataSaverEnabled = true;
let lastUrl = location.href;
let lastVideoId = null;

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

async function syncCurrentVideoId() {
  const id = getVideoId();
  if (id === lastVideoId) return;
  lastVideoId = id;
  try {
    await ext.runtime.sendMessage({ type: "SET_CURRENT_VIDEO_ID", videoId: id });
  } catch (_) {}
}

function currentThumbnail() {
  const id = getVideoId();
  if (id && dataSaverEnabled) {
    // Keep only a small thumbnail for the current video.
    return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
  }
  const meta = document.querySelector('meta[property="og:image"]');
  if (meta?.content) return meta.content;
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}


function suppressSeekPreview() {
  if (!(enabled && dataSaverEnabled)) return;

  // Remove/hide YouTube seek preview and storyboard elements.
  document.querySelectorAll([
    ".ytp-tooltip-bg",
    ".ytp-tooltip",
    ".ytp-preview",
    ".ytp-storyboard-framepreview",
    ".ytp-storyboard-framepreview-img",
    ".ytp-storyboard-framepreview-image",
    ".ytp-hover-progress-light",
    ".ytp-progress-tooltip"
  ].join(",")).forEach((node) => {
    try {
      node.style.setProperty("display", "none", "important");
      node.style.setProperty("background-image", "none", "important");
      if (node.tagName === "IMG") {
        node.removeAttribute("src");
        node.removeAttribute("srcset");
      }
    } catch (_) {}
  });

  // Some preview nodes are created with inline background-image URLs.
  document.querySelectorAll('[style*="ytimg.com/sb/"], img[src*="ytimg.com/sb/"], img[srcset*="ytimg.com/sb/"]').forEach((node) => {
    try {
      node.style.setProperty("display", "none", "important");
      node.style.setProperty("background-image", "none", "important");
      node.removeAttribute?.("src");
      node.removeAttribute?.("srcset");
    } catch (_) {}
  });
}

function suppressDataHeavyUi() {
  document.documentElement.classList.toggle("aoyt-data-saver", enabled && dataSaverEnabled);

  if (!(enabled && dataSaverEnabled)) return;

  // Stop live-chat frames before they can keep polling.
  document.querySelectorAll(
    'ytd-live-chat-frame, #chat, #chat-container, iframe[src*="/live_chat"], iframe[src*="live_chat_replay"]'
  ).forEach((node) => {
    try {
      if (node.tagName === "IFRAME") node.src = "about:blank";
      node.setAttribute("hidden", "");
      node.style.setProperty("display", "none", "important");
    } catch (_) {}
  });

  // Comments are normally lazy-loaded. Keeping them out of layout prevents
  // the usual scroll/intersection trigger and avoids avatars/replies loading.
  document.querySelectorAll('#comments, ytd-comments, ytd-comments-header-renderer').forEach((node) => {
    node.setAttribute("hidden", "");
    node.style.setProperty("display", "none", "important");
  });

  // Recommendation surfaces are hidden as well; their thumbnail image requests
  // are independently blocked by declarativeNetRequest.
  document.querySelectorAll(
    '#related, ytd-watch-next-secondary-results-renderer, ytd-rich-grid-renderer, ytd-reel-shelf-renderer, ytd-shelf-renderer'
  ).forEach((node) => {
    node.setAttribute("hidden", "");
    node.style.setProperty("display", "none", "important");
  });
}


function hardenVideoElements() {
  if (!enabled) return;

  const thumb = currentThumbnail();
  document.querySelectorAll("video").forEach((video) => {
    try {
      // Keep the HTMLMediaElement available for audio controls/miniplayer/PiP,
      // but never expose the video surface in the page. Network blocking is
      // enforced separately by declarativeNetRequest.
      video.style.setProperty("opacity", "0", "important");
      video.style.setProperty("visibility", "hidden", "important");
      if (thumb) video.setAttribute("poster", thumb);
      video.setAttribute("data-aoyt-video-blocked", "1");
    } catch (_) {}
  });
}

function watchPictureInPicture() {
  document.querySelectorAll("video").forEach((video) => {
    if (video.dataset.aoytPipBound === "1") return;
    video.dataset.aoytPipBound = "1";

    video.addEventListener("enterpictureinpicture", () => {
      // PiP may cause YouTube to switch its internal rendition. Re-apply state
      // immediately; network rules continue blocking all identified video media.
      hardenVideoElements();
      syncCurrentVideoId();
    });

    video.addEventListener("webkitpresentationmodechanged", () => {
      hardenVideoElements();
      syncCurrentVideoId();
    });
  });
}

function updateOverlay() {
  document.documentElement.classList.toggle("aoyt-audio-only", enabled);
  suppressDataHeavyUi();
  suppressSeekPreview();
  hardenVideoElements();
  watchPictureInPicture();
  syncCurrentVideoId();

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

let scheduled = false;
function scheduleUpdate() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastVideoId = null;
    }
    updateOverlay();
  });
}

const observer = new MutationObserver(scheduleUpdate);

loadState();
observer.observe(document.documentElement, { subtree: true, childList: true });
window.addEventListener("yt-navigate-finish", () => setTimeout(scheduleUpdate, 50));
