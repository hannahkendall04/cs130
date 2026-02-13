document.getElementById("saveButton").addEventListener("click", async () => {
  const start = parseFloat(document.getElementById("startTime").value);
  const end = parseFloat(document.getElementById("endTime").value);

  if (isNaN(start) || isNaN(end) || start >= end) {
    alert("Please enter a valid start and end time.");
    return;
  }

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  chrome.tabs.sendMessage(tab.id, {
    type: "SKIP_RANGE",
    payload: { start, end }
  });
});
