const ext = globalThis.browser ?? globalThis.chrome;
const VIDEO_RULE_ID = 1001;
const STORYBOARD_RULE_ID = 1002;

function makeVideoBlockRule() {
  return {
    id: VIDEO_RULE_ID,
    priority: 1,
    action: { type: "block" },
    condition: {
      // adaptive配信のvideo-onlyセグメントを止め、audio側は通す。
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

async function applyRules(audioOnlyEnabled, dataSaverEnabled) {
  const addRules = [];
  if (audioOnlyEnabled) addRules.push(makeVideoBlockRule());
  if (audioOnlyEnabled && dataSaverEnabled) addRules.push(makeStoryboardBlockRule());

  try {
    await ext.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [VIDEO_RULE_ID, STORYBOARD_RULE_ID],
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
});
