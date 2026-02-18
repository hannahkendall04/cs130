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
    
    // Threshold to ensure we only download the full subtitle file
    if (parsedSubs.length > 100) {
        chrome.tabs.sendMessage(tabId, { type: "GET_TITLE" }, (response) => {
            const videoTitle = (response && response.title) ? response.title : "Netflix_Show";
            downloadSRT(parsedSubs, videoTitle);
        });
    }
  } catch (err) {
    console.error("Extraction Error:", err);
  }
}

function downloadSRT(subs, filename) {
    const srtContent = convertToSRT(subs);
    const blob = new Blob([srtContent], { type: 'text/srt' });
    const reader = new FileReader();
    
    reader.onloadend = function() {
        chrome.downloads.download({
            url: reader.result,
            filename: `${filename}.srt`,
            saveAs: false
        });
    };
    reader.readAsDataURL(blob);
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