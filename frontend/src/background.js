const API_BASE_URL = "http://127.0.0.1:8000";
const DEFAULT_FILTERS = ["profanity", "sexual_content", "substance_use", "violence"];

// Optional: limit how much we store (SRTs can be big)
const MAX_SRT_CHARS = 600_000; // ~0.6MB of text

/* -----------------------------
   Keep-alive: prevent MV3 service worker from being killed
   during long-running backend calls (Gemini analysis).
------------------------------*/
let keepAliveInterval = null;

function startKeepAlive() {
  if (keepAliveInterval) return;
  keepAliveInterval = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {});
  }, 20_000); // ping every 20s to stay alive
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

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

async function processSubtitles(url, tabId) {
  try {
    const response = await fetch(url, {
      method: "GET",
      credentials: "omit",
    });
    if (!response.ok) return;

    const xmlText = await response.text();
    const parsedSubs = parseDFXP(xmlText);

    // Threshold to ensure we only download the full subtitle file
    if (parsedSubs.length <= 100) return;

    // Clear stale skip ranges immediately so content script shows overlay
    await chromeStorageSet({ skipRanges: [] });

    // Convert to SRT once
    const srtContent = convertToSRT(parsedSubs);

    // Get show info (prefer showId)
    const videoInfo = await getVideoInfo(tabId);
    const videoTitle = videoInfo.title || "Netflix_Show";
    const showId = videoInfo.showId || videoTitle || "Netflix_Show";

    // 1) Store subtitles in chrome.storage so we can reuse later
    await storeLastSubtitle(tabId, {
      showId,
      title: videoTitle,
      srt: truncateSrt(srtContent),
      updatedAt: Date.now(),
    });

    // 3) (Optional but recommended) compute and store skip ranges now
    await maybeComputeSkipRanges(tabId, showId, srtContent);
  } catch (err) {
    console.error("Extraction Error:", err);
  }
}

/* -----------------------------
   Storage: save last subtitles (per tab)
------------------------------*/
function truncateSrt(srt) {
  if (typeof srt !== "string") return "";
  if (srt.length <= MAX_SRT_CHARS) return srt;
  return srt.slice(0, MAX_SRT_CHARS);
}

function chromeStorageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function chromeStorageSet(payload) {
  return new Promise((resolve) => chrome.storage.local.set(payload, resolve));
}

async function storeLastSubtitle(tabId, payload) {
  // Store both:
  // - by tab (for immediate recompute on options change)
  // - by showId (optional, for “resume later” caching)
  const keyByTab = `lastSubtitle:tab:${tabId}`;
  const keyByShow = `lastSubtitle:show:${payload.showId}`;

  await chromeStorageSet({
    [keyByTab]: payload,
    [keyByShow]: payload,
    lastSubtitleTabId: tabId,
    lastSubtitleShowId: payload.showId,
  });

  console.log("Stored last subtitle snapshot:", keyByTab, keyByShow);
}

/* -----------------------------
   (Optional) Compute skip ranges now and store them
------------------------------*/
async function maybeComputeSkipRanges(tabId, showId, srtContent) {
  const { pgifyActive } = await chromeStorageGet(["pgifyActive"]);
  if (pgifyActive !== true) {
    await chromeStorageSet({ skipRanges: [] });
    return;
  }

  const enabledFilters = await getEnabledFilters();
  if (!enabledFilters || enabledFilters.length === 0) {
    await chromeStorageSet({ skipRanges: [] });
    return;
  }

  // Try cache first — instant if this show+filters combo was analyzed before
  const cached = await getCachedTimestamps(showId, enabledFilters);
  if (cached && cached.length > 0) {
    const skipRanges = normalizeRanges(cached);
    await chromeStorageSet({ skipRanges });
    console.log(`Loaded ${skipRanges.length} cached skipRanges for show ${showId}`);
    return;
  }

  // No cache — run streaming Gemini analysis with keep-alive
  startKeepAlive();
  try {
    console.log("Starting streaming skip range analysis for show:", showId);
    await analyzeSubtitlesStream(srtContent, showId, enabledFilters);
  } catch (err) {
    console.error("maybeComputeSkipRanges failed:", err);
    await chromeStorageSet({ skipRanges: [] });
  } finally {
    stopKeepAlive();
  }
}

/* -----------------------------
   Tabs / video info
------------------------------*/
function chromeTabsSendMessage(tabId, msg) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, msg, (resp) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(resp);
    });
  });
}

/*async function getVideoInfo(tabId) {
  const resp = await chromeTabsSendMessage(tabId, { type: "GET_VIDEO_INFO" });
  return {
    title: resp?.title || "Netflix_Show",
    showId: resp?.showId || null,
  };
}*/

async function getVideoInfo(tabId) {
  const tab = await chrome.tabs.get(tabId);
  const match = tab.url?.match(/netflix\.com\/watch\/(\d+)/);
  const showId = match ? match[1] : null;
  const title = tab.title?.replace(" | Netflix", "").trim().replace(/[^a-z0-9]/gi, '_') || "Netflix_Show";
  console.log("getVideoInfo:", { showId, title });
  return { title, showId };
}

async function getEnabledFilters() {
  const data = await chromeStorageGet(["enabledFilters"]);
  if (Array.isArray(data.enabledFilters)) return data.enabledFilters;
  return DEFAULT_FILTERS;
}

/* -----------------------------
   Backend calls
------------------------------*/
async function getCachedTimestamps(showId, enabledFilters) {
  const sortedFilters = [...enabledFilters].sort();                   // ← add this
  const params = new URLSearchParams({ show_id: String(showId) });
  sortedFilters.forEach((f) => params.append("filters", f)); // ← was enabledFilters

  try {
    const res = await fetch(`${API_BASE_URL}/get_timestamps?${params.toString()}`);
    if (!res.ok) return [];

    const payload = await res.json();
    const ranges = payload?.skip_ranges;
    return Array.isArray(ranges) ? ranges : [];
  } catch (e) {
    console.warn("getCachedTimestamps failed", e);
    return [];
  }
}

async function analyzeSubtitlesStream(srtContent, showId, enabledFilters) {
  const payload = {
    subtitle_content: srtContent,
    show_id: String(showId),
    enabled_filters: enabledFilters,
    save_cache: true,
  };

  const res = await fetch(`${API_BASE_URL}/analyze_subtitles_stream`, {
    method: "POST",
    headers: { Accept: "text/event-stream", "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`analyze_subtitles_stream failed: ${res.status} ${errText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = [];
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep incomplete line in buffer

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6));
        const chunkRanges = normalizeRanges(event.skip_ranges);

        if (event.done) {
          // Final event contains merged results — replace accumulated
          await chromeStorageSet({ skipRanges: chunkRanges });
          console.log(`Final: stored ${chunkRanges.length} merged skipRanges`);
        } else {
          // Intermediate — append and write incrementally
          accumulated = accumulated.concat(chunkRanges);
          await chromeStorageSet({ skipRanges: accumulated });
          console.log(`Chunk ${event.chunk}/${event.total_chunks}: stored ${accumulated.length} skipRanges so far`);
        }
      } catch (e) {
        console.warn("Failed to parse SSE event:", line, e);
      }
    }
  }
}

async function analyzeSubtitles(srtContent, showId, enabledFilters) {
  const payload = {
    subtitle_content: srtContent,
    show_id: String(showId),
    enabled_filters: enabledFilters,
    save_cache: true,
  };

  const res = await fetch(`${API_BASE_URL}/analyze_subtitles`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`analyze_subtitles failed: ${res.status} ${errText}`);
  }

  const result = await res.json();
  const ranges = result?.skip_ranges;
  return Array.isArray(ranges) ? ranges : [];
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

/* -----------------------------
   Your existing parsing helpers (unchanged)
------------------------------*/
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

async function getCurrentVideoTime(tabId) {
  const resp = await chromeTabsSendMessage(tabId, { type: "GET_VIDEO_TIME" });
  return resp?.currentTime || 0; // in seconds
}

function trimSrtFromTime(srtContent, startSeconds) {
  if (!startSeconds || startSeconds <= 0) return srtContent;
  
  const startMs = startSeconds * 1000;
  const blocks = srtContent.split("\n\n").filter(Boolean);
  
  const filtered = blocks.filter((block) => {
    // SRT timestamp line looks like: 00:45:00,000 --> 00:45:03,000
    const timeMatch = block.match(/(\d{2}:\d{2}:\d{2},\d{3}) --> /);
    if (!timeMatch) return true; // keep if we can't parse
    const [h, m, s] = timeMatch[1].split(/[:,]/);
    const ms = (+h * 3600 + +m * 60 + +s) * 1000 + +timeMatch[1].split(",")[1];
    return ms >= startMs;
  });
  
  return filtered.join("\n\n");
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