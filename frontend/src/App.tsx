import "./App.css";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Edit, Check } from "lucide-react";
import { useState, useEffect, useRef } from "react";

const FILTER_KEYS = [
  "profanity",
  "sexual_content",
  "substance_use",
  "violence",
] as const;

type FilterKey = (typeof FILTER_KEYS)[number];

function App() {
  const [filterMethod, setFilterMethod] = useState("");
  const [comment, setComment] = useState("");
  const [pgify, setPgify] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [enabledFilterState, setEnabledFilterState] = useState<
    Record<FilterKey, boolean>
  >({
    profanity: true,
    sexual_content: true,
    substance_use: true,
    violence: true,
  });

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
      [
        "filterMethod",
        "pgifyActive",
        "showComments",
        "displayName",
        "enabledFilters",
      ],
      (data) => {
        if (data.filterMethod) setFilterMethod(data.filterMethod);
        if (typeof data.pgifyActive === "boolean") setPgify(data.pgifyActive);
        if (typeof data.showComments === "boolean")
          setShowComments(data.showComments);
        if (typeof data.displayName === "string") setDisplayName(data.displayName);

        if (Array.isArray(data.enabledFilters)) {
          setEnabledFilterState({
            profanity: data.enabledFilters.includes("profanity"),
            sexual_content: data.enabledFilters.includes("sexual_content"),
            substance_use: data.enabledFilters.includes("substance_use"),
            violence: data.enabledFilters.includes("violence"),
          });
        }
      },
    );
  }, []);

  const handleSave = () => {
    const enabledFilters = FILTER_KEYS.filter((key) => enabledFilterState[key]);

    chrome.storage.local.set({
      filterMethod: filterMethod,
      pgifyActive: pgify,
      showComments: showComments,
      enabledFilters,
    });

    alert("Saved filter options");
    window.close();
  };

  const updateFilter = (key: FilterKey, checked: boolean) => {
    setEnabledFilterState((prev) => ({
      ...prev,
      [key]: checked,
    }));
  };

  const handlePost = () => {
    chrome.storage.local.set({
      commentData: {
        comment: comment,
      },
    });
    alert("Posted comment!");
    setComment("");
  };

  const saveDisplayName = (name: string) => {
    chrome.storage.local.set({ displayName: name });
  };

  const handleNameSubmit = () => {
    saveDisplayName(displayName);
    setEditingName(false);
  };

  return (
    <div className="flex w-96 flex-col gap-4 p-4 bg-background text-foreground">
      <h1 className="w-full text-center text-red-500">flixtra</h1>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h2>display name</h2>
          {!editingName && (
            <button
              className="p-1"
              onClick={() => setEditingName(true)}
              aria-label="edit display name"
            >
              <Edit size={16} color="white" />
            </button>
          )}
        </div>
        {editingName ? (
          <div className="flex items-center gap-1">
            <input
              ref={nameInputRef}
              className="flex-1 rounded border border-gray-600 bg-input/30 px-2 py-1 text-sm text-foreground focus:ring-2 focus:ring-red-400 outline-none"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNameSubmit();
              }}
              onBlur={handleNameSubmit}
            />
            <button
              className="p-1"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleNameSubmit}
              aria-label="save display name"
            >
              <Check size={16} color="white" />
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {displayName || "lorem ipsum"}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2>pg-ify</h2>
          <Switch checked={pgify} onCheckedChange={(value) => setPgify(value)} />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={enabledFilterState.profanity}
            onCheckedChange={(value) => updateFilter("profanity", value === true)}
          />
          <p>profanity</p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={enabledFilterState.sexual_content}
            onCheckedChange={(value) =>
              updateFilter("sexual_content", value === true)
            }
          />
          <p>sexual content</p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={enabledFilterState.substance_use}
            onCheckedChange={(value) =>
              updateFilter("substance_use", value === true)
            }
          />
          <p>substance use</p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={enabledFilterState.violence}
            onCheckedChange={(value) => updateFilter("violence", value === true)}
          />
          <p>violence and abuse</p>
        </div>
        <div className="flex flex-col gap-2">
          <h2>filter method</h2>
          <div className="flex gap-2">
            <button
              id="skipButton"
              className={`filter-button ${filterMethod === "skip" ? "bg-red-700" : "bg-red-500 hover:bg-red-700"}`}
              onClick={() => setFilterMethod("skip")}
            >
              skip
            </button>
            <button
              id="muteButton"
              className={`filter-button ${filterMethod === "mute" ? "bg-red-700" : "bg-red-500 hover:bg-red-700"}`}
              onClick={() => setFilterMethod("mute")}
            >
              mute
            </button>
            <button
              id="muteButton"
              className={`filter-button ${filterMethod === "bleep" ? "bg-red-700" : "bg-red-500 hover:bg-red-700"}`}
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
          className="w-full resize-none rounded border border-gray-600 p-2 text-sm text-foreground focus:ring-2 focus:ring-red-400 focus:outline-none"
          rows={3}
          placeholder="Write a comment..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <button
          id="postButton"
          className="w-full rounded bg-red-500 px-4 py-2 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handlePost}
          disabled={!comment.trim()}
        >
          post
        </button>
      </div>
      <div className="flex items-center">
        <button
          id="saveButton"
          className="w-full cursor-pointer rounded bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-700"
          onClick={handleSave}
        >
          save
        </button>
      </div>
    </div>
  );
}

export default App;
