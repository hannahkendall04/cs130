const API_BASE_URL = "http://127.0.0.1:8000";
const DEFAULT_FILTERS = ["profanity", "sexual_content", "substance_use", "violence"];

// tabId -> { srt: string, showId: string }
const lastSubtitleByTab = new Map();

/** -----------------------
 *  Promise wrappers (MV2/MV3 safe)
 *  ----------------------*/
function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
function storageSet(payload) {
  return new Promise((resolve) => chrome.storage.local.set(payload, resolve));
}
function tabsQuery(queryInfo) {
  return new Promise((resolve) => chrome.tabs.query(queryInfo, resolve));
}
function tabsSendMessage(tabId, msg) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, msg, (resp) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(resp);
    });
  });
}

/** -----------------------
 *  WebRequest hook
 *  ----------------------*/
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const url = details.url;

    if (
      details.tabId >= 0 &&
      url.includes("/?o=") &&
      !url.includes(".m4s") &&
      !url.includes(".m4a")
    ) {
      console.log("Subtitle URL Detected:", url);
      processSubtitles(url, details.tabId);
    }
  },
  { urls: ["https://*.nflxvideo.net/*"] }
);

/** -----------------------
 *  Popup -> background: recompute on Save
 *  ----------------------*/
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "FLIXTRA_OPTIONS_UPDATED") {
    recomputeForActiveTab()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error("Options update recompute failed:", err);
        sendResponse({ ok: false, error: String(err) });
      });

    // IMPORTANT: keep message channel open for async
    return true;
  }
});

/** -----------------------
 *  Main logic
 *  ----------------------*/
async function recomputeForActiveTab() {
  const tabs = await tabsQuery({ active: true, currentWindow: true });
  const tab = tabs && tabs[0];
  if (!tab || typeof tab.id !== "number") return;

  const cfg = await storageGet(["pgifyActive"]);
  const pgifyActive = cfg.pgifyActive === true;

  // If turned off, clear ranges immediately
  if (!pgifyActive) {
    await storageSet({ skipRanges: [] });
    return;
  }

  const enabledFilters = await getEnabledFilters();
  if (!enabledFilters || enabledFilters.length === 0) {
    await storageSet({ skipRanges: [] });
    return;
  }

  const last = lastSubtitleByTab.get(tab.id);
  if (!last || !last.srt || !last.showId) {
    console.log("No cached subtitles for this tab yet; waiting for next subtitle fetch.");
    return;
  }

  const cachedRanges = await getCachedTimestamps(last.showId, enabledFilters);
  const skipRangesMs =
    cachedRanges && cachedRanges.length > 0
      ? cachedRanges
      : await analyzeSubtitles(last.srt, last.showId, enabledFilters);

  const skipRanges = normalizeRanges(skipRangesMs);
  await storageSet({ skipRanges });
  console.log(`Recomputed ${skipRanges.length} skipRanges after options update`);
}

async function processSubtitles(url, tabId) {
  try {
    const response = await fetch(url, { method: "GET", credentials: "omit" });
    if (!response.ok) return;

    const xmlText = await response.text();
    const parsedSubs = parseDFXP(xmlText);

    // only process full subtitle files
    if (parsedSubs.length <= 100) return;

    const cfg = await storageGet(["pgifyActive"]);
    const pgifyActive = cfg.pgifyActive === true;

    if (!pgifyActive) {
      await storageSet({ skipRanges: [] });
      return;
    }

    const videoInfo = await getVideoInfo(tabId);
    const showId = (videoInfo && (videoInfo.showId || videoInfo.title)) || "Netflix_Show";
    const enabledFilters = await getEnabledFilters();

    if (!enabledFilters || enabledFilters.length === 0) {
      await storageSet({ skipRanges: [] });
      return;
    }

    const srt = convertToSRT(parsedSubs);
    lastSubtitleByTab.set(tabId, { srt, showId });

    const cachedRanges = await getCachedTimestamps(showId, enabledFilters);
    const skipRangesMs =
      cachedRanges && cachedRanges.length > 0
        ? cachedRanges
        : await analyzeSubtitles(srt, showId, enabledFilters);

    const skipRanges = normalizeRanges(skipRangesMs);
    await storageSet({ skipRanges });
    console.log(`Stored ${skipRanges.length} dynamic skip range(s)`);
  } catch (err) {
    console.error("Extraction Error:", err);
  }
}

async function getVideoInfo(tabId) {
  const resp = await tabsSendMessage(tabId, { type: "GET_VIDEO_INFO" });
  if (!resp) return { title: "Netflix_Show", showId: null };

  return {
    title: resp.title || "Netflix_Show",
    showId: resp.showId || null,
  };
}

async function getEnabledFilters() {
  const data = await storageGet(["enabledFilters"]);
  if (Array.isArray(data.enabledFilters)) return data.enabledFilters;
  return DEFAULT_FILTERS;
}

async function getCachedTimestamps(showId, enabledFilters) {
  const params = new URLSearchParams({ show_id: showId });
  enabledFilters.forEach((filterName) => params.append("filters", filterName));

  try {
    const response = await fetch(`${API_BASE_URL}/get_timestamps?${params.toString()}`);
    if (!response.ok) return null;

    const payload = await response.json();
    return payload.skip_ranges || null;
  } catch (error) {
    console.warn("Failed to fetch cached timestamps", error);
    return null;
  }
}

async function analyzeSubtitles(subtitleContent, showId, enabledFilters) {
  const payload = {
    subtitle_content: subtitleContent,
    show_id: showId,
    enabled_filters: enabledFilters,
    save_cache: true,
  };

  const response = await fetch(`${API_BASE_URL}/analyze_subtitles`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Analyze subtitles failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  return result.skip_ranges || [];
}

function normalizeRanges(ranges) {
  const arr = Array.isArray(ranges) ? ranges : [];
  return arr
    .filter((r) => Number.isFinite(r.start_ms) && Number.isFinite(r.end_ms))
    .map((r) => ({
      start: r.start_ms / 1000,
      end: r.end_ms / 1000,
      category: r.category,
    }));
}

/** -----------------------
 *  Subtitle parsing helpers 
 *  ----------------------*/
function parseDFXP(xmlString) {
  const subs = [];
  const pRegex = /<p[^>]+begin="([^"]+)"[^>]+end="([^"]+)"[^>]*>([\s\S]*?)<\/p>/g;
  let match;
  while ((match = pRegex.exec(xmlString)) !== null) {
    subs.push({
      startMs: convertToMs(match[1]),
      endMs: convertToMs(match[2]),
      text: match[3].replace(/<[^>]*>/g, " ").trim(),
    });
  }
  return subs;
}

function convertToSRT(subs) {
  return subs
    .map((sub, index) => {
      const startTime = formatSRTTime(sub.startMs);
      const endTime = formatSRTTime(sub.endMs);
      return `${index + 1}\n${startTime} --> ${endTime}\n${sub.text}\n`;
    })
    .join("\n");
}

function formatSRTTime(ms) {
  const h = Math.floor(ms / 3600000).toString().padStart(2, "0");
  const m = Math.floor((ms % 3600000) / 60000).toString().padStart(2, "0");
  const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, "0");
  const mm = Math.floor(ms % 1000).toString().padStart(3, "0");
  return `${h}:${m}:${s},${mm}`;
}

function convertToMs(timeStr) {
  if (timeStr.endsWith("t")) return parseInt(timeStr.slice(0, -1), 10) / 10000;
  const parts = timeStr.split(":");
  const seconds = parseFloat(parts.pop());
  const minutes = parseInt(parts.pop() || "0", 10);
  const hours = parseInt(parts.pop() || "0", 10);
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}