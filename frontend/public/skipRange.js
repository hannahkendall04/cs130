console.log("Netflix skip range content script loaded");

let startTime = null;
let endTime = null;
let filterMethod = "";
let bleeping = false;
let bleepCtx = null;

// load time
chrome.storage.local.get(["skipRange", "filterMethod"], (data) => {
  startTime = data.skipRange?.start;
  endTime = data.skipRange?.end;
  filterMethod = data.filterMethod;
});

// check for changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.skipRange) {
    startTime = changes.skipRange.newValue?.start;
    endTime = changes.skipRange.newValue?.end;
  }
  if (changes.filterMethod) {
    filterMethod = changes.filterMethod.newValue;
  }
});

function attachToVideo(video) {
  video.addEventListener("pause", () => pauseBleep());

  video.addEventListener("play", () => {
    if (bleeping) resumeBleep();
  });

  video.addEventListener("timeupdate", () => {
    console.log(`Current time: ${video.currentTime}`); // for debugging purposes/easy view in console
    if (startTime !== null && endTime !== null) {
      if (video.currentTime >= startTime && video.currentTime < endTime) {
        if (filterMethod === "skip") {
          window.postMessage({ type: "NETFLIX_SEEK", time: endTime * 1000 }, "*");
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


// console.log("skipRange.js loaded (Netflix POC)");

// // Load saved skip range from chrome.storage
// let skipRange = null;

// chrome.storage.local.get("skipRange", (data) => {
//   if (data.skipRange) {
//     skipRange = { start: data.skipRange.start, end: data.skipRange.end };
//     console.log("Loaded skip range:", skipRange);
//   }
// });

// // Helper: get Netflix player
// function getNetflixPlayer() {
//   try {
//     const playerApp = window.netflix?.appContext?.state?.playerApp;
//     if (!playerApp) return null;

//     const videoPlayer = playerApp.getAPI().videoPlayer;
//     const sessionId = videoPlayer.getAllPlayerSessionIds()[0];
//     return { videoPlayer, sessionId };
//   } catch (e) {
//     return null;
//   }
// }

// // Attach skip logic to Netflix player
// function attachSkip() {
//   const playerObj = getNetflixPlayer();
//   if (!playerObj || !skipRange) return;

//   const { videoPlayer, sessionId } = playerObj;

//   // Avoid attaching multiple intervals
//   if (videoPlayer.__skipAttached) return;
//   videoPlayer.__skipAttached = true;

//   console.log("Skip listener attached to Netflix player");

//   // Check every 500ms for current time
//   const intervalId = setInterval(() => {
//     const currentTime = videoPlayer.getCurrentTime(sessionId);

//     if (
//       currentTime >= skipRange.start &&
//       currentTime < skipRange.end
//     ) {
//       console.log(`Skipping from ${skipRange.start} → ${skipRange.end}`);
//       videoPlayer.seek(sessionId, skipRange.end);
//     }
//   }, 500);
// }

// // Netflix loads videos dynamically, watch for page changes
// const observer = new MutationObserver(() => {
//   const playerObj = getNetflixPlayer();
//   if (playerObj && skipRange) {
//     attachSkip();
//   }
// });

// observer.observe(document.body, { childList: true, subtree: true });

// // Also attempt to attach immediately in case player is ready
// attachSkip();
