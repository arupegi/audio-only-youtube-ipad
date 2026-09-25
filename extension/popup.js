const ext = globalThis.browser ?? globalThis.chrome;

const toggle = document.getElementById("toggle");
const dataSaver = document.getElementById("dataSaver");
const status = document.getElementById("status");
const videoTitle = document.getElementById("videoTitle");
const videoUrl = document.getElementById("videoUrl");
const thumbnail = document.getElementById("thumbnail");
const thumbPlaceholder = document.getElementById("thumbPlaceholder");
const quality = document.getElementById("quality");
const format = document.getElementById("format");
const usageHint = document.getElementById("usageHint");
const downloadButton = document.getElementById("downloadButton");
const downloadStatus = document.getElementById("downloadStatus");
const serverUrlInput = document.getElementById("serverUrl");
const saveServerButton = document.getElementById("saveServer");
const trafficTotal = document.getElementById("trafficTotal");
const trafficAudio = document.getElementById("trafficAudio");
const trafficImages = document.getElementById("trafficImages");
const trafficOther = document.getElementById("trafficOther");
const resetUsage = document.getElementById("resetUsage");
const exportUsage = document.getElementById("exportUsage");
const exportStatus = document.getElementById("exportStatus");

let activeTab = null;
let currentInfo = null;

function render(enabled) {
  toggle.checked = enabled;
  status.textContent = enabled ? "音声のみモード：ON" : "通常再生：ON";
}

function renderUsageHint() {
  const q = quality.value;
  const fmt = format.value;
  const rates = { "256": 115.2, "192": 86.4, "128": 57.6, "96": 43.2, "64": 28.8 };

  if (q === "efficient") {
    usageHint.textContent = "おすすめ：元音源の効率が良い音声を優先。目安は約50〜70MB/1時間で、再エンコードもできるだけ避けます。";
  } else if (q === "best") {
    usageHint.textContent = "最高音質：配信されている最良音声を優先します。通信量は動画ごとに変わります。";
  } else {
    usageHint.textContent = `概算：約${rates[q].toFixed(1)}MB/1時間（${q}kbps、音声本体のみ）。`;
  }

  if (fmt === "mp3") usageHint.textContent += " MP3は変換が必要なため、元音源のままより効率が落ちる場合があります。";
  if (fmt === "source") usageHint.textContent += " 元音源のままなら余計な再圧縮をしません。";
}


function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function showUsage(usage) {
  trafficTotal.textContent = formatBytes(usage?.total || 0);
  trafficAudio.textContent = formatBytes(usage?.audio || 0);
  trafficImages.textContent = formatBytes(usage?.images || 0);
  trafficOther.textContent = formatBytes((usage?.other || 0) + (usage?.video || 0));
}

async function refreshUsage() {
  try {
    if (!activeTab) activeTab = await getActiveTab();
    if (!activeTab?.id) return showUsage(null);
    const usage = await ext.runtime.sendMessage({ type: "GET_USAGE", tabId: activeTab.id });
    showUsage(usage);
  } catch (_) {
    showUsage(null);
  }
}


function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function safeFilePart(value) {
  return String(value || "youtube")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60) || "youtube";
}

async function exportUsageCsv() {
  exportStatus.textContent = "CSVを作成中…";
  try {
    if (!activeTab) activeTab = await getActiveTab();
    const usage = activeTab?.id
      ? await ext.runtime.sendMessage({ type: "GET_USAGE", tabId: activeTab.id })
      : null;
    if (!currentInfo && activeTab) currentInfo = await readPageInfo(activeTab);

    const now = new Date();
    const rows = [
      [
        "exported_at",
        "title",
        "url",
        "total_bytes",
        "audio_bytes",
        "image_bytes",
        "other_bytes",
        "video_bytes",
        "responses",
        "counter_updated_at"
      ],
      [
        now.toISOString(),
        currentInfo?.title || activeTab?.title || "YouTube",
        currentInfo?.url || activeTab?.url || "",
        usage?.total || 0,
        usage?.audio || 0,
        usage?.images || 0,
        usage?.other || 0,
        usage?.video || 0,
        usage?.responses || 0,
        usage?.updatedAt ? new Date(usage.updatedAt).toISOString() : ""
      ]
    ];

    // UTF-8 BOM helps Excel on Windows/iPad recognize Japanese correctly.
    const csv = "\uFEFF" + rows.map(row => row.map(csvEscape).join(",")).join("\r\n") + "\r\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const stamp = now.toISOString().replace(/[:.]/g, "-");
    const filename = `youtube-traffic-${safeFilePart(currentInfo?.title)}-${stamp}.csv`;
    const file = new File([blob], filename, { type: "text/csv" });

    // iPad Safari: prefer the native share sheet so the CSV can be saved to Files.
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title: "YouTube通信量 CSV" });
      exportStatus.textContent = "共有メニューから「ファイルに保存」を選べます。";
      return;
    }

    // Desktop/fallback: trigger a normal file download.
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    exportStatus.textContent = "CSVを出力しました。";
  } catch (error) {
    if (error?.name === "AbortError") {
      exportStatus.textContent = "CSV出力をキャンセルしました。";
    } else {
      console.error("CSV export failed", error);
      exportStatus.textContent = "CSV出力に失敗しました。";
    }
  }
}

function normalizeServerUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function isYouTubeUrl(value) {
  try {
    const u = new URL(value);
    return /(^|\.)youtube\.com$/.test(u.hostname) || u.hostname === "youtu.be";
  } catch (_) {
    return false;
  }
}

async function getActiveTab() {
  const tabs = await ext.tabs.query({ active: true, currentWindow: true });
  return tabs?.[0] ?? null;
}

async function readPageInfo(tab) {
  if (!tab?.id || !isYouTubeUrl(tab.url)) return null;
  try {
    return await ext.tabs.sendMessage(tab.id, { type: "GET_PAGE_INFO" });
  } catch (_) {
    return { url: tab.url, title: tab.title || "YouTube", thumbnail: null };
  }
}

function showPageInfo(info) {
  currentInfo = info;
  const valid = Boolean(info?.url && isYouTubeUrl(info.url));
  downloadButton.disabled = !valid;
  videoTitle.textContent = valid ? (info.title || "YouTube") : "YouTube動画をSafariで開いてください";
  videoUrl.textContent = valid ? info.url : "";

  if (valid && info.thumbnail) {
    thumbnail.src = info.thumbnail;
    thumbnail.hidden = false;
    thumbPlaceholder.hidden = true;
  } else {
    thumbnail.removeAttribute("src");
    thumbnail.hidden = true;
    thumbPlaceholder.hidden = false;
  }
}

async function openDownload() {
  const serverUrl = normalizeServerUrl(serverUrlInput.value);
  if (!serverUrl) {
    downloadStatus.textContent = "先に「サーバー設定」から変換サーバーURLを設定してください。";
    return;
  }
  if (!currentInfo?.url || !isYouTubeUrl(currentInfo.url)) {
    downloadStatus.textContent = "YouTube動画を開いてから実行してください。";
    return;
  }

  const params = new URLSearchParams({
    url: currentInfo.url,
    quality: quality.value,
    format: format.value
  });
  const target = `${serverUrl}/api/download?${params.toString()}`;

  downloadStatus.textContent = "Safariの新しいタブで音声だけを取得します…";
  try {
    await ext.tabs.create({ url: target, active: true });
  } catch (_) {
    window.open(target, "_blank", "noopener,noreferrer");
  }
}

(async () => {
  const saved = await ext.storage.local.get([
    "audioOnlyEnabled", "dataSaverEnabled", "downloadServerUrl", "downloadQuality", "downloadFormat"
  ]);
  render(saved.audioOnlyEnabled ?? true);
  dataSaver.checked = saved.dataSaverEnabled ?? true;
  serverUrlInput.value = saved.downloadServerUrl || "";
  quality.value = saved.downloadQuality || "efficient";
  format.value = saved.downloadFormat || "source";
  renderUsageHint();

  try {
    activeTab = await getActiveTab();
    showPageInfo(await readPageInfo(activeTab));
  } catch (_) {
    showPageInfo(null);
  }
  await refreshUsage();
})();

setInterval(refreshUsage, 1000);

exportUsage.addEventListener("click", exportUsageCsv);

resetUsage.addEventListener("click", async () => {
  try {
    if (!activeTab) activeTab = await getActiveTab();
    const usage = await ext.runtime.sendMessage({ type: "RESET_USAGE", tabId: activeTab?.id });
    showUsage(usage);
  } catch (_) {}
});

toggle.addEventListener("change", async () => {
  const enabled = toggle.checked;
  render(enabled);
  await ext.runtime.sendMessage({ type: "SET_AUDIO_ONLY", enabled });
  try {
    if (!activeTab) activeTab = await getActiveTab();
    if (activeTab?.id) await ext.tabs.sendMessage(activeTab.id, { type: "AUDIO_ONLY_STATE", enabled });
  } catch (_) {}
});

dataSaver.addEventListener("change", async () => {
  const enabled = dataSaver.checked;
  await ext.runtime.sendMessage({ type: "SET_DATA_SAVER", enabled });
  try {
    if (!activeTab) activeTab = await getActiveTab();
    if (activeTab?.id) {
      await ext.tabs.sendMessage(activeTab.id, { type: "DATA_SAVER_STATE", enabled });
      showPageInfo(await readPageInfo(activeTab));
    }
  } catch (_) {}
});

quality.addEventListener("change", () => {
  ext.storage.local.set({ downloadQuality: quality.value });
  renderUsageHint();
});
format.addEventListener("change", () => {
  ext.storage.local.set({ downloadFormat: format.value });
  renderUsageHint();
});

downloadButton.addEventListener("click", openDownload);

saveServerButton.addEventListener("click", async () => {
  const value = normalizeServerUrl(serverUrlInput.value);
  serverUrlInput.value = value;
  await ext.storage.local.set({ downloadServerUrl: value });
  downloadStatus.textContent = value ? "サーバーURLを保存しました。" : "サーバーURLを消去しました。";
});
