console.log("Netflix skip range content script loaded");

let skipRanges = [];
let filterMethod = "";
let bleeping = false;
let bleepCtx = null;
let filterContent = false;

// load time
chrome.storage.local.get(["skipRanges", "skipRange", "filterMethod", "pgifyActive"], (data) => {
  if (Array.isArray(data.skipRanges)) {
    skipRanges = data.skipRanges;
  } else if (data.skipRange?.start != null && data.skipRange?.end != null) {
    skipRanges = [data.skipRange];
  }

  filterMethod = data.filterMethod;
  filterContent = data.pgifyActive === true;
});

// check for changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.skipRanges) {
    skipRanges = Array.isArray(changes.skipRanges.newValue)
      ? changes.skipRanges.newValue
      : [];
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
    console.log(`Current time: ${video.currentTime}`); // for debugging purposes/easy view in console
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
  const video = document.querySelector("video");
  if (video && !video.dataset.skipAttached) {
    video.dataset.skipAttached = true;
    attachToVideo(video);
    console.log("added event listener to video")
  }
}, 1000);