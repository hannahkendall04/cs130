console.log("YouTube content script loaded");

function muteYouTube() {
  const video = document.querySelector('video');
  if (video) {
    video.muted = true;   // 🔇 mute
    return true;
  }
  return false;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "MUTE_YOUTUBE") {   // you can rename later if you want
    const success = muteYouTube();
    sendResponse({ success });
  }
});