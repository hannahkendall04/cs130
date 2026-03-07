console.log("Netflix skip range content script loaded");

let skipRanges = [];
let filterMethod = "";
let bleeping = false;
let bleepCtx = null;
let filterContent = false;
let analyzing = false;

function getVideo() {
  return document.querySelector("video");
}

function showAnalyzingOverlay() {
  if (document.getElementById("pgify-overlay")) return;

  // Retry pausing until video element exists
  const tryPause = () => {
    const video = getVideo();
    if (video) {
      video.pause();
    } else {
      setTimeout(tryPause, 200);
    }
  };
  tryPause();

  const overlay = document.createElement("div");
  overlay.id = "pgify-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.85);
    z-index: 99999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    font-family: Netflix Sans, Arial, sans-serif;
  `;

  overlay.innerHTML = `
    <div style="
      width: 48px; height: 48px;
      border: 4px solid rgba(255,255,255,0.2);
      border-top-color: #E50914;
      border-radius: 50%;
      animation: pgify-spin 0.8s linear infinite;
      margin-bottom: 20px;
    "></div>
    <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Analyzing content...</div>
    <div style="font-size: 13px; color: rgba(255,255,255,0.6);">Flixtra is scanning this episode. Just a moment.</div>

    <style>
      @keyframes pgify-spin {
        to { transform: rotate(360deg); }
      }
    </style>
  `;

  document.body.appendChild(overlay);
}

function hideAnalyzingOverlay() {
  const overlay = document.getElementById("pgify-overlay");
  if (overlay) overlay.remove();

  const tryPlay = () => {
    const video = getVideo();
    if (video) {
      video.play().catch(() => {
        setTimeout(tryPlay, 200);
      });
    } else {
      setTimeout(tryPlay, 200);
    }
  };
  tryPlay();
}

// load time
chrome.storage.local.get(["skipRanges", "skipRange", "filterMethod", "pgifyActive"], (data) => {
  if (Array.isArray(data.skipRanges)) {
    skipRanges = data.skipRanges;
  } else if (data.skipRange?.start != null && data.skipRange?.end != null) {
    skipRanges = [data.skipRange];
  }

  filterMethod = data.filterMethod;
  filterContent = data.pgifyActive === true;
  if (filterContent && skipRanges.length === 0) {
    analyzing = true;
    showAnalyzingOverlay();
  }
});

// check for changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.skipRanges) {
    const newRanges = changes.skipRanges.newValue;
    skipRanges = Array.isArray(newRanges) ? newRanges : [];

    if (skipRanges.length === 0 && filterContent) {
      // New episode started — show overlay again
      analyzing = true;
      showAnalyzingOverlay();
    } else if (analyzing && skipRanges.length > 0) {
      // First chunk landed — unblock
      analyzing = false;
      hideAnalyzingOverlay();
    }
  } else if (changes.skipRange) {
    const range = changes.skipRange.newValue;
    skipRanges = range?.start != null && range?.end != null ? [range] : [];
  }

  if (changes.filterMethod) {
    filterMethod = changes.filterMethod.newValue;
  }

  if (changes.pgifyActive) {
    filterContent = changes.pgifyActive.newValue;
  }
});

const observer = new MutationObserver(() => {
  if (!window.location.href.includes("/watch/")) {
    if (analyzing) {
      analyzing = false;
      hideAnalyzingOverlay();
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });

function getActiveRange(currentTime) {
  return skipRanges.find(
    (range) =>
      typeof range?.start === "number" &&
      typeof range?.end === "number" &&
      currentTime >= range.start &&
      currentTime < range.end,
  );
}
function attachToVideo(video) {
  video.addEventListener("pause", () => pauseBleep());

  video.addEventListener("play", () => {
    if (bleeping) resumeBleep();
  });

  video.addEventListener("timeupdate", () => {
    // console.log(`Current time: ${video.currentTime}`); // for debugging purposes/easy view in console
    if (filterContent) {
      const activeRange = getActiveRange(video.currentTime);

      if (activeRange) {
        if (filterMethod === "skip") {
          window.postMessage({ type: "NETFLIX_SEEK", time: activeRange.end * 1000 }, "*");
        } else if ((filterMethod === "mute" || filterMethod === "bleep") && !video.muted) {
          video.muted = true;
        } else {
          console.log("No filter method selected");
        }

        if (filterMethod === "bleep" && !bleeping) {
          startBleep();
          bleeping = true;
        }
      } else if ((filterMethod === "mute" || filterMethod === "bleep") && video.muted) {
        video.muted = false;
        if (bleeping) {
          stopBleep();
          bleeping = false;
        }
      }
    }
  })
}

function startBleep() {
  if (bleepCtx) return; // already bleeping

  bleepCtx = new AudioContext();
  const oscillator = bleepCtx.createOscillator();
  const gainNode = bleepCtx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(bleepCtx.destination);
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(1000, bleepCtx.currentTime);
  gainNode.gain.setValueAtTime(1, bleepCtx.currentTime);

  oscillator.start();
}

function stopBleep() {
  if (!bleepCtx) return;
  bleepCtx.close();
  bleepCtx = null;
}

function pauseBleep() {
  if (bleepCtx && bleepCtx.state === 'running') {
    bleepCtx.suspend();
  }
}

function resumeBleep() {
  if (bleepCtx && bleepCtx.state === 'suspended') {
    bleepCtx.resume();
  }
}


setInterval(() => {
  const video = getVideo();
  if (video && !video.dataset.skipAttached) {
    video.dataset.skipAttached = true;
    attachToVideo(video);
    console.log("added event listener to video")
  }
}, 1000);