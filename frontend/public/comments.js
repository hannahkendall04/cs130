console.log("flixtra comments script loaded");

let comment = null;
let user = null;
let showId = null;
let commentStartTime = null;
let showComments = false;
let allComments = [];
let commentInterval = null;
let currentShowId = null;
let commentsSyncInterval = null;
const LAYOUT_STYLE_ID = "flixtra-layout-style";
const SIDEBAR_WIDTH_VAR = "--flixtra-sidebar-width";
const DEFAULT_SIDEBAR_WIDTH = 400;

// load time
chrome.storage.local.get(
  ["commentData", "showComments", "displayName"],
  (data) => {
    comment = data.commentData?.comment;
    showComments = data.showComments;
    user = data.displayName || "anonymous";
    syncCommentsVisibility();
  },
);

startCommentsSync();

// check for changes
chrome.storage.onChanged.addListener(async (changes) => {
  if (changes.commentData) {
    const video = document.querySelector("video");
    if (video) {
      comment = changes.commentData.newValue?.comment;
      showId = getNetflixTrackId();
      commentStartTime = video.currentTime;

      // post comment
      await postComment();

      // clear data
      chrome.storage.local.remove("commentData", function () {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
        } else {
          console.log("Comment data removed");
        }
      });
    }
  }

  if (changes.displayName) {
    user = changes.displayName.newValue || "anonymous";
  }

  if (changes.showComments) {
    showComments = changes.showComments.newValue;
    currentShowId = null;
    await syncCommentsVisibility();
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "FLIXTRA_SET_SHOW_COMMENTS") return;

  showComments = message.showComments === true;
  currentShowId = null;
  syncCommentsVisibility();
});

function isNetflixWatchPage() {
  return /^https?:\/\/(www\.)?netflix\.com\/watch\/\d+/.test(
    window.location.href,
  );
}

function shouldShowCommentsPanel() {
  return showComments === true && isNetflixWatchPage();
}

async function syncCommentsVisibility() {
  if (!shouldShowCommentsPanel()) {
    unwrapNetflixPage();
    currentShowId = null;
    return;
  }

  wrapNetflixPage();
  applyNetflixLayoutOffset(getCurrentSidebarWidth());
  attachPlaybackLifecycle();

  const latestShowId = getNetflixTrackId();
  if (!latestShowId) return;

  if (latestShowId !== currentShowId) {
    showId = latestShowId;
    currentShowId = latestShowId;
    await getComments();
  }
}

function startCommentsSync() {
  if (commentsSyncInterval) return;

  commentsSyncInterval = setInterval(() => {
    syncCommentsVisibility();
  }, 1000);
}

function attachPlaybackLifecycle() {
  const video = document.querySelector("video");
  if (!video || video.dataset.flixtraCommentsAttached === "true") return;

  video.dataset.flixtraCommentsAttached = "true";
  video.addEventListener("ended", handlePlaybackEnded);
}

function handlePlaybackEnded() {
  if (!showComments) return;

  chrome.storage.local.set({ showComments: false }, () => {
    unwrapNetflixPage();
  });
}

// frontend connection to post comments fastapi functionality
async function postComment() {
  // only run if comment is not null
  console.log("posting comment...");
  if (comment && comment !== "") {
    let postData = {
      user: user,
      showId: showId,
      comment: comment,
      startTime: String(commentStartTime),
      endTime: String(commentStartTime + 15),
    };

    const post_comments_url = "http://127.0.0.1:8000/post_comment";

    try {
      const response = await fetch(post_comments_url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(postData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `HTTP error! Status: ${response.status}, Details: ${errorData.detail}`,
        );
      }

      const result = await response.json();
      console.log(`Successfully posted comment: ${result}`);
      await getComments();
    } catch (error) {
      console.error(`Error posting comment: ${error}`);
    }
  }
}

function getNetflixTrackId() {
  try {
    const pathname = window.location.pathname;
    const pathSegments = pathname.split("/");

    // The ID is the last segment in the path
    const trackId = pathSegments[pathSegments.length - 1];

    // Validate if the ID is a number
    if (/^\d+$/.test(trackId)) {
      return trackId;
    }
  } catch (error) {
    console.error("Invalid URL:", error);
  }
  return null; // Return null if ID not found or URL is invalid
}

// frontend connection to get comments fastapi functionality
async function getComments() {
  // only run if showComments is true
  if (shouldShowCommentsPanel()) {
    if (!showId) {
      console.log("grabbing show id...");
      showId = getNetflixTrackId();
    }

    console.log(`Show ID: ${showId}`); // non null

    console.log(`Show ID Type: ${typeof showId}`); // string

    let getData = {
      show_id: showId,
    };

    const get_comments_url = "http://127.0.0.1:8000/get_comments";

    try {
      const response = await fetch(get_comments_url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(getData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `HTTP error! Status: ${response.status}, Details: ${errorData.detail}`,
        );
      }

      const result = await response.json();
      console.log(`Successfully grabbed comments! ${result}`);
      allComments = result.comments;
      if (!commentInterval) {
        commentInterval = setInterval(sendVisibleComments, 1000);
      }
    } catch (error) {
      console.error(`Error getting comments: ${error}`);
    }
  }
}

function sendVisibleComments() {
  const video = document.querySelector("video");
  const iframe = document.getElementById("flixtra-iframe");
  if (!video || !iframe?.contentWindow) return;
  const currentTime = video.currentTime;
  const visible = allComments.filter(
    (c) => parseFloat(c.startTime) <= currentTime,
  );
  iframe.contentWindow.postMessage(
    { type: "FLIXTRA_COMMENTS", comments: visible },
    "*",
  );
}

function wrapNetflixPage() {
  if (document.getElementById("flixtra-iframe")) return;

  const iframe = document.createElement("iframe");
  iframe.id = "flixtra-iframe";
  iframe.src = chrome.runtime.getURL("iframe.html");

  iframe.style.position = "fixed";
  iframe.style.top = "0";
  iframe.style.right = "0";
  iframe.style.width = DEFAULT_SIDEBAR_WIDTH + "px";
  iframe.style.height = "100vh";
  iframe.style.border = "none";
  iframe.style.zIndex = "999999";
  iframe.style.backgroundColor = "#141414";

  document.body.appendChild(iframe);
  ensureLayoutStyles();
  applyNetflixLayoutOffset(DEFAULT_SIDEBAR_WIDTH);
}

function getCurrentSidebarWidth() {
  const iframe = document.getElementById("flixtra-iframe");
  const width = Number.parseInt(iframe?.style.width || "", 10);
  return Number.isFinite(width) && width > 0 ? width : DEFAULT_SIDEBAR_WIDTH;
}

function ensureLayoutStyles() {
  if (document.getElementById(LAYOUT_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = LAYOUT_STYLE_ID;
  style.textContent = `
    body.flixtra-comments-open {
      margin-right: var(${SIDEBAR_WIDTH_VAR}) !important;
      transition: margin-right 0.15s ease;
    }

    body.flixtra-comments-open #appMountPoint {
      margin-right: var(${SIDEBAR_WIDTH_VAR}) !important;
      width: calc(100% - var(${SIDEBAR_WIDTH_VAR})) !important;
      transition: margin-right 0.15s ease, width 0.15s ease;
    }

    body.flixtra-comments-open .watch-video,
    body.flixtra-comments-open .watch-video--player-view,
    body.flixtra-comments-open .watch-video--player-view-container {
      right: var(${SIDEBAR_WIDTH_VAR}) !important;
      transition: right 0.15s ease;
    }
  `;

  document.head.appendChild(style);
}

function applyNetflixLayoutOffset(width) {
  const widthPx = `${width}px`;
  ensureLayoutStyles();

  document.body.classList.add("flixtra-comments-open");
  document.body.style.setProperty(SIDEBAR_WIDTH_VAR, widthPx);

  document.body.style.marginRight = widthPx;
  document.body.style.transition = "margin-right 0.15s ease";

  const appMountPoint = document.getElementById("appMountPoint");
  if (appMountPoint) {
    appMountPoint.style.marginRight = widthPx;
    appMountPoint.style.width = `calc(100% - ${width}px)`;
    appMountPoint.style.transition =
      "margin-right 0.15s ease, width 0.15s ease";
  }

  const playerView = document.querySelector(".watch-video--player-view");
  if (playerView instanceof HTMLElement) {
    playerView.style.right = widthPx;
    playerView.style.transition = "right 0.15s ease";
  }
}

function clearNetflixLayoutOffset() {
  document.body.classList.remove("flixtra-comments-open");
  document.body.style.removeProperty(SIDEBAR_WIDTH_VAR);

  document.body.style.marginRight = "0";
  document.body.style.transition = "";

  const appMountPoint = document.getElementById("appMountPoint");
  if (appMountPoint) {
    appMountPoint.style.marginRight = "";
    appMountPoint.style.width = "";
    appMountPoint.style.transition = "";
  }

  const playerView = document.querySelector(".watch-video--player-view");
  if (playerView instanceof HTMLElement) {
    playerView.style.right = "";
    playerView.style.transition = "";
  }
}

function unwrapNetflixPage() {
  clearInterval(commentInterval);
  commentInterval = null;
  allComments = [];
  // Remove the iframe
  const iframe = document.getElementById("flixtra-iframe");
  if (iframe) {
    iframe.remove();
  }

  // Reset Netflix page margin
  clearNetflixLayoutOffset();
}
