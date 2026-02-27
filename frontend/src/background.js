const API_BASE_URL = "http://127.0.0.1:8000";
const DEFAULT_FILTERS = [
  "profanity",
  "sexual_content",
  "substance_use",
  "violence",
];

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const url = details.url;
    if (details.tabId >= 0 && url.includes("/?o=") && !url.includes(".m4s") && !url.includes(".m4a")) {
      console.log("Subtitle URL Detected:", url);
      processSubtitles(url, details.tabId);
    }
  },
  { urls: ["https://*.nflxvideo.net/*"] }
);

async function processSubtitles(url, tabId) {
  try {
    const response = await fetch(url, { 
        method: 'GET',
        credentials: 'omit' 
    });

    if (!response.ok) return;
    
    const xmlText = await response.text();
    const parsedSubs = parseDFXP(xmlText);
    
    // Threshold to ensure we only process full subtitle files
    if (parsedSubs.length > 100) {
      const videoInfo = await getVideoInfo(tabId);
      const showId = videoInfo.showId || videoInfo.title || "Netflix_Show";
      const enabledFilters = await getEnabledFilters();

      if (enabledFilters.length === 0) {
        await setLocalStorage({ skipRanges: [] });
        return;
      }

      const cachedRanges = await getCachedTimestamps(showId, enabledFilters);
      const skipRangesMs =
        cachedRanges && cachedRanges.length > 0
          ? cachedRanges
          : await analyzeSubtitles(convertToSRT(parsedSubs), showId, enabledFilters);

      const skipRanges = normalizeRanges(skipRangesMs);
      await setLocalStorage({ skipRanges });
      console.log(`Stored ${skipRanges.length} dynamic skip range(s)`);
    }
  } catch (err) {
    console.error("Extraction Error:", err);
  }
}

function setLocalStorage(payload) {
  return new Promise((resolve) => {
    chrome.storage.local.set(payload, () => resolve());
  });
}

function getVideoInfo(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "GET_VIDEO_INFO" }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ title: "Netflix_Show", showId: null });
        return;
      }

      resolve({
        title: response?.title || "Netflix_Show",
        showId: response?.showId || null,
      });
    });
  });
}

function getEnabledFilters() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["enabledFilters"], (data) => {
      if (Array.isArray(data.enabledFilters)) {
        resolve(data.enabledFilters);
        return;
      }

      resolve(DEFAULT_FILTERS);
    });
  });
}

async function getCachedTimestamps(showId, enabledFilters) {
  const params = new URLSearchParams({ show_id: showId });
  enabledFilters.forEach((filterName) => params.append("filters", filterName));

  try {
    const response = await fetch(`${API_BASE_URL}/get_timestamps?${params.toString()}`);
    if (!response.ok) {
      return null;
    }

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
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Analyze subtitles failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  return result.skip_ranges || [];
}

function normalizeRanges(ranges = []) {
  return ranges
    .filter((range) => Number.isFinite(range.start_ms) && Number.isFinite(range.end_ms))
    .map((range) => ({
      start: range.start_ms / 1000,
      end: range.end_ms / 1000,
      category: range.category,
    }));
}

function parseDFXP(xmlString) {
  const subs = [];
  const pRegex = /<p[^>]+begin="([^"]+)"[^>]+end="([^"]+)"[^>]*>([\s\S]*?)<\/p>/g;
  let match;
  while ((match = pRegex.exec(xmlString)) !== null) {
    subs.push({
      startMs: convertToMs(match[1]),
      endMs: convertToMs(match[2]),
      text: match[3].replace(/<[^>]*>/g, ' ').trim()
    });
  }
  return subs;
}

function convertToSRT(subs) {
  return subs.map((sub, index) => {
    const startTime = formatSRTTime(sub.startMs);
    const endTime = formatSRTTime(sub.endMs);
    return `${index + 1}\n${startTime} --> ${endTime}\n${sub.text}\n`;
  }).join('\n');
}

function formatSRTTime(ms) {
  const h = Math.floor(ms / 3600000).toString().padStart(2, '0');
  const m = Math.floor((ms % 3600000) / 60000).toString().padStart(2, '0');
  const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
  const mm = Math.floor(ms % 1000).toString().padStart(3, '0');
  return `${h}:${m}:${s},${mm}`;
}

function convertToMs(timeStr) {
  if (timeStr.endsWith('t')) return parseInt(timeStr.slice(0, -1)) / 10000;
  const parts = timeStr.split(':');
  const seconds = parseFloat(parts.pop());
  const minutes = parseInt(parts.pop() || 0);
  const hours = parseInt(parts.pop() || 0);
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}