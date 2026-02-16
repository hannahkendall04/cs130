console.log("Netflix skip range content script loaded");

let startTime = null;
let endTime = null;

chrome.storage.local.get("skipRange", (data) => {
  if (data.skipRange) {
    startTime = data.skipRange.start;
    endTime = data.skipRange.end;
  }
});

function attachToVideo(video) {
  video.addEventListener("timeupdate", () => {
    console.log(`Current time: ${video.currentTime}`);
    console.log(`Current time type: ${typeof(video.currentTime)}`);
    if (startTime !== null && endTime !== null) {
      if (video.currentTime >= startTime && video.currentTime < endTime) {
        video.currentTime = endTime;
      }
    }
  })
}


setInterval(() => {
  const video = document.querySelector("video");
  console.log("HERE!")
  if (video && !video.dataset.skipAttached) {
    video.dataset.skipAttached = true;
    attachToVideo(video);
    console.log("added event listener to video")
  }
}, 1000);