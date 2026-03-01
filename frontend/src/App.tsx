import "./App.css";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Edit, Check } from "lucide-react";
import { useState, useEffect, useRef } from "react";

function App() {
  const [filterMethod, setFilterMethod] = useState("");
  // const [comment, setComment] = useState("");
  const [pgify, setPgify] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [editingName]);

  useEffect(() => {
    chrome.storage.local.get(
      ["filterMethod", "pgifyActive", "showComments", "displayName"],
      (data) => {
        if (data.filterMethod) setFilterMethod(data.filterMethod);
        if (typeof data.pgifyActive === "boolean") setPgify(data.pgifyActive);
        if (typeof data.showComments === "boolean")
          setShowComments(data.showComments);
        if (typeof data.displayName === "string")
          setDisplayName(data.displayName);
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
    window.close();
  };

  // const handlePost = () => {
  //   chrome.storage.local.set({
  //     commentData: {
  //       comment: comment,
  //     },
  //   });
  //   alert("Posted comment!");
  //   setComment("");
  // };

  const saveDisplayName = (name: string) => {
    chrome.storage.local.set({ displayName: name });
  };

  const handleNameSubmit = () => {
    saveDisplayName(displayName);
    setEditingName(false);
  };

  return (
    <div className="bg-background text-foreground flex w-96 flex-col gap-4 p-4">
      <h1 className="text-primary w-full text-center">flixtra</h1>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1">
          <h2>display name</h2>
          {!editingName && (
            <button
              className="text-primary hover:text-accent p-1 transition-all duration-300 ease-in-out hover:cursor-pointer"
              onClick={() => setEditingName(true)}
              aria-label="edit display name"
            >
              <Edit size={16} />
            </button>
          )}
        </div>
        {editingName ? (
          <div className="flex items-center gap-1">
            <input
              ref={nameInputRef}
              className="bg-input/30 focus:border-ring flex-1 rounded border px-2 py-1 text-sm outline-none"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNameSubmit();
              }}
              onBlur={handleNameSubmit}
            />
            <button
              className="hover:text-accent text-primary p-1 transition-all duration-300 ease-in-out hover:cursor-pointer"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleNameSubmit}
              aria-label="save display name"
            >
              <Check size={16} />
            </button>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            {displayName || "lorem ipsum"}
          </p>
        )}
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
      </div>
      <div className="flex flex-col gap-2">
        <h2>filter method</h2>
        <div className="flex gap-2">
          <button
            id="skipButton"
            className={`red-button w-1/3 ${filterMethod === "skip" && "bg-accent"}`}
            onClick={() => setFilterMethod("skip")}
          >
            skip
          </button>
          <button
            id="muteButton"
            className={`red-button w-1/3 ${filterMethod === "mute" && "bg-accent"}`}
            onClick={() => setFilterMethod("mute")}
          >
            mute
          </button>
          <button
            id="muteButton"
            className={`red-button w-1/3 ${filterMethod === "bleep" && "bg-accent"}`}
            onClick={() => setFilterMethod("bleep")}
          >
            bleep
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <h2>show comments section</h2>
        <Switch
          checked={showComments}
          onCheckedChange={(value) => setShowComments(value)}
        />
      </div>
      <div className="mt-4 flex items-center">
        <button
          id="saveButton"
          className="red-button w-full"
          onClick={handleSave}
        >
          save
        </button>
      </div>
    </div>
  );
}

export default App;
