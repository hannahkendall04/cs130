console.log("YouTube skip range content script loaded");

let startTime = null;
let endTime = null;

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request) => {
  if (request.type === "SKIP_RANGE") {
    startTime = request.payload.start;
    endTime = request.payload.end;
    console.log("Skip range set:", startTime, endTime);
  }
});

// Check the video time repeatedly
setInterval(() => {
  if (startTime === null || endTime === null) return;

  const video = document.querySelector("video");
  if (!video) return;

  if (video.currentTime >= startTime && video.currentTime < endTime) {
    console.log(`Skipping from ${startTime} to ${endTime}`);
    video.currentTime = endTime;
  }
}, 500);
