function Bleeper() {

  const bleep = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;

      chrome.tabs.sendMessage(tabs[0].id!, {
        type: "MUTE_YOUTUBE"
      });
    });
  }

  return (
    <>
      <button onClick={bleep} className="rounded-md bg-red-500 p-2 text-white">
        Click me to bleep!
      </button>
    </>
  );
}

export default Bleeper;
