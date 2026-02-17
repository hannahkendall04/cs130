// work around for not being able to seek w/ video.currentTime in netflix 
// via claude
function seekNetflix(timeMs) {
  try {
    const vp = netflix.appContext.state.playerApp.getAPI().videoPlayer;
    const id = vp.getAllPlayerSessionIds()[0];
    vp.getVideoPlayerBySessionId(id).seek(timeMs);
  } catch (e) {
    console.error("Netflix seek failed:", e);
  }
}

window.addEventListener("message", (event) => {
  if (event.source === window && event.data?.type === "NETFLIX_SEEK") {
    seekNetflix(event.data.time);
  }
});