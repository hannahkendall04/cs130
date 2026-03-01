console.log("flixtra Content Script Active");

function getNetflixTitle() {
  const titleElement = document.querySelector('.ltr-1698661, .video-title, .title');
  if (titleElement && titleElement.innerText) {
    return titleElement.innerText.trim().replace(/[^a-z0-9]/gi, '_');
  }
  return "Netflix_Subtitles";
}
function getNetflixShowId() {
  const match = window.location.href.match(/netflix\.com\/watch\/(\d+)/);
  return match ? match[1] : null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_TITLE") {
    sendResponse({ title: getNetflixTitle() });
  }
  if (message.type === "GET_VIDEO_INFO") {
    sendResponse({
      title: getNetflixTitle(),
      showId: getNetflixShowId(),  // e.g. "81234567"
    });
  }
  return true; 
});