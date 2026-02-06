console.log("flixtra Content Script Active");

function getNetflixTitle() {
  const titleElement = document.querySelector('.ltr-1698661, .video-title, .title');
  if (titleElement && titleElement.innerText) {
    return titleElement.innerText.trim().replace(/[^a-z0-9]/gi, '_');
  }
  return "Netflix_Subtitles";
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_TITLE") {
    sendResponse({ title: getNetflixTitle() });
  }
  return true; 
});