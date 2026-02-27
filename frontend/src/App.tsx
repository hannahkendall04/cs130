import "./App.css";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Edit } from "lucide-react";
import { useState, useEffect } from "react";

function App() {
  const [filterMethod, setFilterMethod] = useState("");
  const [comment, setComment] = useState("");
  const [pgify, setPgify] = useState(false);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(
      ["filterMethod", "pgifyActive", "showComments"],
      (data) => {
        if (data.filterMethod) setFilterMethod(data.filterMethod);
        if (typeof data.pgifyActive === "boolean") setPgify(data.pgifyActive);
        if (typeof data.showComments === "boolean")
          setShowComments(data.showComments);
      },
    );
  }, []);

  // testing - constant time ranges
  const startNum = 10;
  const endNum = 30;
  // end testing

  // testing - constant time range on save
  const handleSave = () => {
    chrome.storage.local.set({
      skipRange: {
        start: startNum,
        end: endNum,
      },
      filterMethod: filterMethod,
      pgifyActive: pgify,
      showComments: showComments,
    });
    alert("Saved filter options");
  };

  const handlePost = () => {
    chrome.storage.local.set({
      commentData: {
        comment: comment,
      },
    });
    alert("Posted comment!");
  };

  return (
    <div className="flex w-96 flex-col gap-4 p-4">
      <h1 className="w-full text-center">flixtra</h1>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h2>display name</h2>
          <Edit size={16} color="grey" />
        </div>
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
        <div className="flex flex-col gap-2">
          <h2>filter method</h2>
          <div className="flex gap-2">
            <button
              id="skipButton"
              className={`filter-button ${filterMethod === "skip" ? "bg-blue-700" : "bg-blue-500 hover:bg-blue-700"}`}
              onClick={() => setFilterMethod("skip")}
            >
              skip
            </button>
            <button
              id="muteButton"
              className={`filter-button ${filterMethod === "mute" ? "bg-blue-700" : "bg-blue-500 hover:bg-blue-700"}`}
              onClick={() => setFilterMethod("mute")}
            >
              mute
            </button>
            <button
              id="muteButton"
              className={`filter-button ${filterMethod === "bleep" ? "bg-blue-700" : "bg-blue-500 hover:bg-blue-700"}`}
              onClick={() => setFilterMethod("bleep")}
            >
              bleep
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <h2>show comments section</h2>
        <Switch
          checked={showComments}
          onCheckedChange={(value) => setShowComments(value)}
        />
      </div>
      {/* Post a Comment Section */}
      <div className="flex flex-col gap-2">
        <h2>post a comment</h2>
        <textarea
          className="w-full resize-none rounded border border-gray-300 p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
          rows={3}
          placeholder="Write a comment..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <button
          id="postButton"
          className="w-full rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handlePost}
          disabled={!comment.trim()}
        >
          post
        </button>
      </div>
      <div className="flex items-center">
        <button
          id="saveButton"
          className="w-full cursor-pointer rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-700"
          onClick={handleSave}
        >
          save
        </button>
      </div>
    </div>
  );
}

export default App;
