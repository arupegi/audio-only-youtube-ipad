const ext = globalThis.browser ?? globalThis.chrome;

const VIDEO_RULE_ID = 1001;
const STORYBOARD_RULE_ID = 1002;
const OTHER_THUMBNAILS_RULE_ID = 1003;
const CURRENT_THUMBNAIL_ALLOW_RULE_ID = 1004;
const LIVE_CHAT_RULE_ID = 1005;
const STORYBOARD_ENDPOINT_RULE_ID = 1006;

let currentVideoId = null;

function makeVideoBlockRule() {
  return {
    id: VIDEO_RULE_ID,
    priority: 1,
    action: { type: "block" },
    condition: {
      // Block adaptive video-only media while leaving audio media available.
      regexFilter: "^https?://[^/]*googlevideo\\.com/videoplayback\\?.*(?:mime(?:=|%3D)video(?:%2F|/)|mime%3Dvideo%252F)",
      resourceTypes: ["media", "xmlhttprequest", "other"]
    }
  };
}

function makeStoryboardBlockRule() {
  return {
    id: STORYBOARD_RULE_ID,
    priority: 1,
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
    priority: 2,
    action: { type: "block" },
    condition: {
      // Block storyboard / seek-preview image endpoints that may be fetched lazily.
      regexFilter: "^https?://(?:www\.)?youtube\.com/(?:api/)?storyboard",
      resourceTypes: ["image", "xmlhttprequest", "other"]
    }
  };
}

function makeOtherThumbnailsBlockRule() {
  return {
    id: OTHER_THUMBNAILS_RULE_ID,
    priority: 1,
    action: { type: "block" },
    condition: {
      // Recommendation/home/search/playlist thumbnails.
      regexFilter: "^https?://i\\.ytimg\\.com/(?:vi|vi_webp|an_webp)/",
      resourceTypes: ["image", "xmlhttprequest", "other"]
    }
  };
}

function makeCurrentThumbnailAllowRule(videoId) {
  const escaped = String(videoId).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
  return {
    id: CURRENT_THUMBNAIL_ALLOW_RULE_ID,
    priority: 10,
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
    priority: 2,
    action: { type: "block" },
    condition: {
      regexFilter: "^https?://(?:www\\.)?youtube\\.com/(?:live_chat(?:_replay)?(?:\\?|/)|youtubei/v1/live_chat/)",
      resourceTypes: ["sub_frame", "xmlhttprequest", "other"]
    }
  };
}

async function applyRules(audioOnlyEnabled, dataSaverEnabled) {
  const addRules = [];

  if (audioOnlyEnabled) addRules.push(makeVideoBlockRule());

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
        VIDEO_RULE_ID,
        STORYBOARD_RULE_ID,
        OTHER_THUMBNAILS_RULE_ID,
        CURRENT_THUMBNAIL_ALLOW_RULE_ID,
        LIVE_CHAT_RULE_ID,
        STORYBOARD_ENDPOINT_RULE_ID
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

ext.runtime.onInstalled.addListener(async () => {
  const state = await readState();
  await applyRules(state.audioOnlyEnabled, state.dataSaverEnabled);
});

ext.runtime.onMessage.addListener(async (message) => {
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
});
