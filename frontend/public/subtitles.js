console.log("flixtra Content Script Active");

function getNetflixTitle() {
  const titleElement = document.querySelector('.ltr-1698661, .video-title, .title');
  if (titleElement && titleElement.innerText) {
    return titleElement.innerText.trim().replace(/[^a-z0-9]/gi, '_');
  }
  return "Netflix_Subtitles";
}

function getNetflixShowId() {
  try {
    const pathname = window.location.pathname;
    const pathSegments = pathname.split("/");
    const idCandidate = pathSegments[pathSegments.length - 1];

    if (/^\d+$/.test(idCandidate)) {
      return idCandidate;
    }
  } catch (error) {
    console.error("Unable to parse show ID", error);
  }

  return null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_TITLE") {
    sendResponse({ title: getNetflixTitle() });
  }

  if (message.type === "GET_VIDEO_INFO") {
    sendResponse({
      title: getNetflixTitle(),
      showId: getNetflixShowId(),
    });
  }

  return true; 
});