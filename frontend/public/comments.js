console.log("flixtra comments script loaded");

let comment = null;
let user = null;
let showId = null;
let commentStartTime = null;
let showComments = false;
let allComments = [];
let commentInterval = null;

// load time
chrome.storage.local.get(["commentData", "showComments", "displayName"], (data) => {
  comment = data.commentData?.comment;
  showComments = data.showComments;
  user = data.displayName || "anonymous";
});

chrome.storage.local.get(["showComments"], (data) => {
  if (data.showComments) {
    console.log("showing comments 1");
    showComments = true;
    wrapNetflixPage();
    showId = getNetflixTrackId();
    getComments();
  } else {
    console.log("not showing comments 1");
    unwrapNetflixPage();
  }
});

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
    showId = getNetflixTrackId();

    if (showComments) {
      console.log("showing comments 2");
      wrapNetflixPage();
      await getComments();
    } else {
      console.log("not showing comments 2");
      unwrapNetflixPage();
    }
  }
});

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
  if (showComments) {
    if (!showId) {
      console.log("grabbing show id...");
      showId = getNetflixTrackId();
    }

    console.log(`Show ID: ${showId}`); // non null

    console.log(`Show ID Type: ${typeof(showId)}`); // string

    let getData = {
      show_id: showId,
    };

    const get_comments_url = "http://127.0.0.1:8000/get_comments";

    try {
      const response = await fetch(get_comments_url, {
        method: "POST",
        headers: {
          'Accept': "application/json",
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
  const visible = allComments.filter(c => parseFloat(c.startTime) <= currentTime);
  iframe.contentWindow.postMessage({ type: "FLIXTRA_COMMENTS", comments: visible }, "*");
}

function wrapNetflixPage() {
  if (document.getElementById("flixtra-iframe")) return;

  const DEFAULT_WIDTH = 400;

  const iframe = document.createElement("iframe");
  iframe.id = "flixtra-iframe";
  iframe.src = chrome.runtime.getURL("iframe.html");

  iframe.style.position = "fixed";
  iframe.style.top = "0";
  iframe.style.right = "0";
  iframe.style.width = DEFAULT_WIDTH + "px";
  iframe.style.height = "100vh";
  iframe.style.border = "none";
  iframe.style.zIndex = "999999";
  iframe.style.backgroundColor = "#141414";

  document.body.appendChild(iframe);

  // Push Netflix content left
  document.body.style.marginRight = DEFAULT_WIDTH + "px";

  // Listen for resize messages from iframe
  window.addEventListener("message", (event) => {
    if (event.data?.type === "FLIXTRA_RESIZE") {
      const newWidth = event.data.width;

      iframe.style.width = newWidth + "px";
      document.body.style.marginRight = newWidth + "px";
    }
  });

  document.body.style.transition = "margin-right 0.15s ease";
}

function unwrapNetflixPage() {
  console.log("unwrapping netflix page");
  clearInterval(commentInterval);
  commentInterval = null;
  allComments = [];
  // Remove the iframe
  const iframe = document.getElementById("flixtra-iframe");
  if (iframe) {
    iframe.remove();
  }

  // Reset Netflix page margin
  document.body.style.marginRight = "0";

  console.log("Flixtra iframe removed, Netflix page restored.");
}
