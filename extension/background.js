const ext = globalThis.browser ?? globalThis.chrome;

const VIDEO_MIME_RULE_ID = 1001;
const STORYBOARD_RULE_ID = 1002;
const OTHER_THUMBNAILS_RULE_ID = 1003;
const CURRENT_THUMBNAIL_ALLOW_RULE_ID = 1004;
const LIVE_CHAT_RULE_ID = 1005;
const STORYBOARD_ENDPOINT_RULE_ID = 1006;
const VIDEO_ITAG_RULE_ID = 1007;
const VIDEO_ITAG_ENCODED_RULE_ID = 1008;
const VIDEO_MANIFEST_RULE_ID = 1009;

let currentVideoId = null;

function makeVideoMimeBlockRule() {
  return {
    id: VIDEO_MIME_RULE_ID,
    priority: 20,
    action: { type: "block" },
    condition: {
      // Block every googlevideo media request that explicitly declares a video MIME type.
      // Covers plain and URL-encoded query strings used by normal, miniplayer and PiP playback.
      regexFilter: "^https?://[^/]*googlevideo\\.com/(?:videoplayback|initplayback).*?(?:[?&]|%26)mime(?:=|%3D)video(?:/|%2F|%252F)",
      resourceTypes: ["media", "xmlhttprequest", "other"]
    }
  };
}

function makeVideoItagBlockRule() {
  // Known YouTube muxed/video-only itags. Audio-only itags such as
  // 139/140/141/249/250/251 are intentionally not listed.
  const videoItags = [
    17, 18, 22, 37, 38,
    133, 134, 135, 136, 137, 160, 212, 264, 266,
    242, 243, 244, 247, 248, 271, 272, 278,
    298, 299, 302, 303, 308, 313, 315,
    330, 331, 332, 333, 334, 335, 336, 337,
    394, 395, 396, 397, 398, 399, 400, 401, 571
  ].join("|");

  return {
    id: VIDEO_ITAG_RULE_ID,
    priority: 19,
    action: { type: "block" },
    condition: {
      regexFilter: `^https?://[^/]*googlevideo\\.com/(?:videoplayback|initplayback).*?[?&]itag=(?:${videoItags})(?:&|$)`,
      resourceTypes: ["media", "xmlhttprequest", "other"]
    }
  };
}

function makeEncodedVideoItagBlockRule() {
  const videoItags = [
    17, 18, 22, 37, 38,
    133, 134, 135, 136, 137, 160, 212, 264, 266,
    242, 243, 244, 247, 248, 271, 272, 278,
    298, 299, 302, 303, 308, 313, 315,
    330, 331, 332, 333, 334, 335, 336, 337,
    394, 395, 396, 397, 398, 399, 400, 401, 571
  ].join("|");

  return {
    id: VIDEO_ITAG_ENCODED_RULE_ID,
    priority: 19,
    action: { type: "block" },
    condition: {
      regexFilter: `^https?://[^/]*googlevideo\\.com/(?:videoplayback|initplayback).*?(?:itag%3D|itag%253D)(?:${videoItags})(?:%26|%2526|$)`,
      resourceTypes: ["media", "xmlhttprequest", "other"]
    }
  };
}

function makeVideoManifestBlockRule() {
  return {
    id: VIDEO_MANIFEST_RULE_ID,
    priority: 18,
    action: { type: "block" },
    condition: {
      // Prevent video-specific adaptive manifests from being requested when
      // YouTube switches playback mode for miniplayer/PiP/live playback.
      regexFilter: "^https?://(?:manifest\\.googlevideo\\.com|[^/]*googlevideo\\.com)/.*?(?:mime(?:=|%3D)video|type(?:=|%3D)video)",
      resourceTypes: ["media", "xmlhttprequest", "other"]
    }
  };
}

function makeStoryboardBlockRule() {
  return {
    id: STORYBOARD_RULE_ID,
    priority: 10,
    action: { type: "block" },
    condition: {
      regexFilter: "^https?://i\\.ytimg\\.com/sb/",
      resourceTypes: ["image", "xmlhttprequest", "other"]
    }
  };
}

function makeStoryboardEndpointBlockRule() {
  return {
    id: STORYBOARD_ENDPOINT_RULE_ID,
    priority: 11,
    action: { type: "block" },
    condition: {
      regexFilter: "^https?://(?:www\\.)?youtube\\.com/(?:api/)?storyboard",
      resourceTypes: ["image", "xmlhttprequest", "other"]
    }
  };
}

function makeOtherThumbnailsBlockRule() {
  return {
    id: OTHER_THUMBNAILS_RULE_ID,
    priority: 10,
    action: { type: "block" },
    condition: {
      regexFilter: "^https?://i\\.ytimg\\.com/(?:vi|vi_webp|an_webp)/",
      resourceTypes: ["image", "xmlhttprequest", "other"]
    }
  };
}

function makeCurrentThumbnailAllowRule(videoId) {
  const escaped = String(videoId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return {
    id: CURRENT_THUMBNAIL_ALLOW_RULE_ID,
    priority: 100,
    action: { type: "allow" },
    condition: {
      regexFilter: `^https?://i\\.ytimg\\.com/(?:vi|vi_webp)/${escaped}/`,
      resourceTypes: ["image", "xmlhttprequest", "other"]
    }
  };
}

function makeLiveChatBlockRule() {
  return {
    id: LIVE_CHAT_RULE_ID,
    priority: 11,
    action: { type: "block" },
    condition: {
      regexFilter: "^https?://(?:www\\.)?youtube\\.com/(?:live_chat(?:_replay)?(?:\\?|/)|youtubei/v1/live_chat/)",
      resourceTypes: ["sub_frame", "xmlhttprequest", "other"]
    }
  };
}

async function applyRules(audioOnlyEnabled, dataSaverEnabled) {
  const addRules = [];

  if (audioOnlyEnabled) {
    // Strict network-layer video blocking. These rules remain active regardless
    // of normal player, YouTube miniplayer or native Picture in Picture state.
    addRules.push(makeVideoMimeBlockRule());
    addRules.push(makeVideoItagBlockRule());
    addRules.push(makeEncodedVideoItagBlockRule());
    addRules.push(makeVideoManifestBlockRule());
  }

  if (audioOnlyEnabled && dataSaverEnabled) {
    addRules.push(makeStoryboardBlockRule());
    addRules.push(makeStoryboardEndpointBlockRule());
    addRules.push(makeOtherThumbnailsBlockRule());
    addRules.push(makeLiveChatBlockRule());
    if (currentVideoId) addRules.push(makeCurrentThumbnailAllowRule(currentVideoId));
  }

  try {
    await ext.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [
        VIDEO_MIME_RULE_ID,
        STORYBOARD_RULE_ID,
        OTHER_THUMBNAILS_RULE_ID,
        CURRENT_THUMBNAIL_ALLOW_RULE_ID,
        LIVE_CHAT_RULE_ID,
        STORYBOARD_ENDPOINT_RULE_ID,
        VIDEO_ITAG_RULE_ID,
        VIDEO_ITAG_ENCODED_RULE_ID,
        VIDEO_MANIFEST_RULE_ID
      ],
      addRules
    });
    await ext.storage.local.set({ audioOnlyEnabled, dataSaverEnabled });
  } catch (error) {
    console.error("Audio Only YouTube: failed to update rules", error);
  }
}

async function readState() {
  const result = await ext.storage.local.get(["audioOnlyEnabled", "dataSaverEnabled"]);
  return {
    audioOnlyEnabled: result.audioOnlyEnabled ?? true,
    dataSaverEnabled: result.dataSaverEnabled ?? true
  };
}



// Approximate received-byte counter. We sum Content-Length from responses that
// Safari exposes to the WebExtension. This is useful for comparing modes, but
// it is not a carrier/billing-grade traffic meter (cache/protocol overhead and
// responses without Content-Length may not be represented exactly).
const usageByTab = new Map();
const AUDIO_ITAGS = new Set([139, 140, 141, 249, 250, 251, 256, 258, 325, 328]);
const VIDEO_ITAGS = new Set([
  17,18,22,37,38,133,134,135,136,137,160,212,264,266,242,243,244,247,248,
  271,272,278,298,299,302,303,308,313,315,330,331,332,333,334,335,336,337,
  394,395,396,397,398,399,400,401,571
]);

function emptyUsage() {
  return { total: 0, audio: 0, video: 0, images: 0, other: 0, responses: 0, updatedAt: Date.now() };
}

function getUsage(tabId) {
  if (!usageByTab.has(tabId)) usageByTab.set(tabId, emptyUsage());
  return usageByTab.get(tabId);
}

function queryParamLoose(url, key) {
  try {
    const u = new URL(url);
    const direct = u.searchParams.get(key);
    if (direct != null) return direct;
    const decoded = decodeURIComponent(url);
    const m = decoded.match(new RegExp('(?:[?&]|%26)' + key + '(?:=|%3D)([^&%]+)', 'i'));
    return m ? m[1] : null;
  } catch (_) {
    return null;
  }
}

function classifyRequest(url, type) {
  const lower = String(url || '').toLowerCase();
  if (lower.includes('googlevideo.com')) {
    const mime = String(queryParamLoose(url, 'mime') || '').toLowerCase();
    const itag = Number(queryParamLoose(url, 'itag'));
    if (mime.startsWith('audio/') || AUDIO_ITAGS.has(itag)) return 'audio';
    if (mime.startsWith('video/') || VIDEO_ITAGS.has(itag)) return 'video';
    return 'other';
  }
  if (lower.includes('ytimg.com') || type === 'image') return 'images';
  return 'other';
}

function contentLengthFromHeaders(headers) {
  if (!Array.isArray(headers)) return 0;
  for (const h of headers) {
    if (String(h?.name || '').toLowerCase() === 'content-length') {
      const n = Number(h.value);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return 0;
}

try {
  ext.webRequest?.onHeadersReceived?.addListener(
    (details) => {
      if (details.tabId == null || details.tabId < 0) return;
      if (![200, 206].includes(details.statusCode)) return;
      const url = String(details.url || '');
      if (!/(?:youtube\.com|googlevideo\.com|ytimg\.com)/i.test(url)) return;
      const bytes = contentLengthFromHeaders(details.responseHeaders);
      if (!bytes) return;
      const usage = getUsage(details.tabId);
      const bucket = classifyRequest(url, details.type);
      usage.total += bytes;
      usage[bucket] += bytes;
      usage.responses += 1;
      usage.updatedAt = Date.now();
    },
    { urls: ['*://*.youtube.com/*', '*://youtube.com/*', '*://*.googlevideo.com/*', '*://*.ytimg.com/*'] },
    ['responseHeaders']
  );
} catch (error) {
  console.warn('Audio Only YouTube: traffic counter unavailable', error);
}

ext.runtime.onInstalled.addListener(async () => {
  const state = await readState();
  await applyRules(state.audioOnlyEnabled, state.dataSaverEnabled);
});

ext.runtime.onStartup?.addListener(async () => {
  const state = await readState();
  await applyRules(state.audioOnlyEnabled, state.dataSaverEnabled);
});

ext.runtime.onMessage.addListener(async (message, sender) => {
  if (message?.type === "SET_AUDIO_ONLY") {
    const state = await readState();
    return applyRules(Boolean(message.enabled), state.dataSaverEnabled);
  }

  if (message?.type === "SET_DATA_SAVER") {
    const state = await readState();
    return applyRules(state.audioOnlyEnabled, Boolean(message.enabled));
  }

  if (message?.type === "SET_CURRENT_VIDEO_ID") {
    currentVideoId = typeof message.videoId === "string" && message.videoId ? message.videoId : null;
    const state = await readState();
    return applyRules(state.audioOnlyEnabled, state.dataSaverEnabled);
  }

  if (message?.type === "GET_USAGE") {
    const tabId = Number.isInteger(message.tabId) ? message.tabId : sender?.tab?.id;
    return tabId >= 0 ? { ...getUsage(tabId) } : emptyUsage();
  }

  if (message?.type === "RESET_USAGE") {
    const tabId = Number.isInteger(message.tabId) ? message.tabId : sender?.tab?.id;
    if (tabId >= 0) usageByTab.set(tabId, emptyUsage());
    return tabId >= 0 ? { ...getUsage(tabId) } : emptyUsage();
  }
});
