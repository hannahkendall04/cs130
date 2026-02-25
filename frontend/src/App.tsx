import "./App.css";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useState } from 'react';

function App() {

  const [filterMethod, setFilterMethod] = useState("");
  const [comment, setComment] = useState("");
  const [pgify, setPgify] = useState(false);
  const [showComments, setShowComments] = useState(false);

  // testing - constant time ranges 
  const startNum = 10;
  const endNum = 30;
  // end testing 

  // testing - constant time range on save
  const handleSave = () => {
    chrome.storage.local.set({
      skipRange: {
        start: startNum,
        end: endNum
      },
      filterMethod: filterMethod,
      pgifyActive: pgify,
      showComments: showComments
    });
    alert("Saved filter options")
  }

  const handlePost = () => {
      chrome.storage.local.set({
        commentData: {
          comment: comment
        }
      });
      alert("Posted comment!");
  }

  return (
    <div className="flex w-96 flex-col gap-4 p-4">
      <h1 className="w-full text-center">flixtra</h1>
      <div className="flex flex-col gap-2">
        <h2>display name</h2>
        <p>lorem ipsum</p>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2>pg-ify</h2>
          <Switch onClick={() => setPgify(!pgify)} />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox />
          <p>profanity</p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox />
          <p>sexual content</p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox />
          <p>substance use</p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox />
          <p>violence and abuse</p>
        </div>
        <div className="flex gap-2 flex-col">
          <h2>Filter method</h2>
          <div className="flex px-2 gap-2">
            <button id="skipButton" className={`w-[50%] cursor-pointer rounded text-white mb-2 ${filterMethod === "skip" ? "bg-blue-700" : "bg-blue-500 hover:bg-blue-700"}`} onClick={() => setFilterMethod("skip")}>skip</button>
            <button id="muteButton" className={`w-[50%] cursor-pointer rounded text-white mb-2 ${filterMethod === "mute" ? "bg-blue-700" : "bg-blue-500 hover:bg-blue-700"}`} onClick={() => setFilterMethod("mute")}>mute</button>
            <button id="muteButton" className={`w-[50%] cursor-pointer rounded text-white mb-2 ${filterMethod === "bleep" ? "bg-blue-700" : "bg-blue-500 hover:bg-blue-700"}`} onClick={() => setFilterMethod("bleep")}>bleep</button>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <h2>show comments section</h2>
        <Switch onClick={() => setShowComments(!showComments)}/>
      </div>
      {/* Post a Comment Section */}
      <div className="flex flex-col gap-2">
        <h2>post a comment</h2>
        <textarea
          className="w-full rounded border border-gray-300 p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
          rows={3}
          placeholder="Write a comment..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <button
          id="postButton"
          className="w-full rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handlePost}
          disabled={!comment.trim()}
        >
          post
        </button>
      </div>
      <div className="flex items-center">
        <button id="saveButton" className="w-full rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-700" onClick={handleSave}>save</button>
      </div>
    </div>
  );
}

export default App;
