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
  "bullying",
] as const;

type FilterKey = (typeof FILTER_KEYS)[number];
type FilterMethod = "skip" | "mute" | "bleep";

function App() {
  const [filterMethod, setFilterMethod] = useState<FilterMethod>("skip");
  const [pgify, setPgify] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isWatchPage, setIsWatchPage] = useState(false);
  const [preferencesLocked, setPreferencesLocked] = useState(false);
  const [showLockedMessage, setShowLockedMessage] = useState(false);
  const lockMessageTimeoutRef = useRef<number | null>(null);
  const [enabledFilterState, setEnabledFilterState] = useState<
    Record<FilterKey, boolean>
  >({
    profanity: true,
    sexual_content: true,
    substance_use: true,
    violence: true,
    bullying: true,
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
        if (
          data.filterMethod === "skip" ||
          data.filterMethod === "mute" ||
          data.filterMethod === "bleep"
        ) {
          setFilterMethod(data.filterMethod);
        }

        if (typeof data.pgifyActive === "boolean") setPgify(data.pgifyActive);
        if (typeof data.showComments === "boolean")
          setShowComments(data.showComments);
        if (typeof data.displayName === "string")
          setDisplayName(data.displayName);

        if (Array.isArray(data.enabledFilters)) {
          setEnabledFilterState({
            profanity: data.enabledFilters.includes("profanity"),
            sexual_content: data.enabledFilters.includes("sexual_content"),
            substance_use: data.enabledFilters.includes("substance_use"),
            violence: data.enabledFilters.includes("violence"),
            bullying: data.enabledFilters.includes("bullying"),
          });
        }
      },
    );
  }, []);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTabUrl = tabs?.[0]?.url ?? "";
      const watchingEpisode = /^https?:\/\/(www\.)?netflix\.com\/watch\/\d+/.test(
        activeTabUrl,
      );
      setIsWatchPage(watchingEpisode);
      setPreferencesLocked(watchingEpisode);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (lockMessageTimeoutRef.current !== null) {
        window.clearTimeout(lockMessageTimeoutRef.current);
      }
    };
  }, []);

  const showPreferencesLockedMessage = () => {
    setShowLockedMessage(true);

    if (lockMessageTimeoutRef.current !== null) {
      window.clearTimeout(lockMessageTimeoutRef.current);
    }

    lockMessageTimeoutRef.current = window.setTimeout(() => {
      setShowLockedMessage(false);
      lockMessageTimeoutRef.current = null;
    }, 2500);
  };

  const handleLockedPreferenceAction = (action: () => void) => {
    if (preferencesLocked) {
      showPreferencesLockedMessage();
      return;
    }

    action();
  };

  const updateFilter = (key: FilterKey, checked: boolean) => {
    setEnabledFilterState((prev) => ({
      ...prev,
      [key]: checked,
    }));
  };

  const handleSave = () => {
    const enabledFilters = FILTER_KEYS.filter((key) => enabledFilterState[key]);

    chrome.storage.local.set(
      {
        filterMethod,
        pgifyActive: pgify,
        showComments,
        enabledFilters,
      },
      () => {
        // IMPORTANT: tell background to recompute skip ranges immediately
        chrome.runtime.sendMessage({ type: "FLIXTRA_OPTIONS_UPDATED" });

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const activeTabId = tabs?.[0]?.id;
          if (typeof activeTabId === "number") {
            chrome.tabs.sendMessage(activeTabId, {
              type: "FLIXTRA_SET_SHOW_COMMENTS",
              showComments,
            });
          }
        });

        alert("Saved filter options");
        window.close();
      },
    );
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

  const lockedControlClass = preferencesLocked
    ? "opacity-50 cursor-not-allowed"
    : "";

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
          <Switch
            className={lockedControlClass}
            checked={pgify}
            onCheckedChange={(value) =>
              handleLockedPreferenceAction(() => setPgify(value))
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            className={lockedControlClass}
            checked={enabledFilterState.profanity}
            onCheckedChange={(value) =>
              handleLockedPreferenceAction(() =>
                updateFilter("profanity", value === true),
              )
            }
          />
          <p>profanity</p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            className={lockedControlClass}
            checked={enabledFilterState.sexual_content}
            onCheckedChange={(value) =>
              handleLockedPreferenceAction(() =>
                updateFilter("sexual_content", value === true),
              )
            }
          />
          <p>sexual content</p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            className={lockedControlClass}
            checked={enabledFilterState.substance_use}
            onCheckedChange={(value) =>
              handleLockedPreferenceAction(() =>
                updateFilter("substance_use", value === true),
              )
            }
          />
          <p>substance use</p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            className={lockedControlClass}
            checked={enabledFilterState.violence}
            onCheckedChange={(value) =>
              handleLockedPreferenceAction(() =>
                updateFilter("violence", value === true),
              )
            }
          />
          <p>violence and abuse</p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            className={lockedControlClass}
            checked={enabledFilterState.bullying}
            onCheckedChange={(value) =>
              handleLockedPreferenceAction(() =>
                updateFilter("bullying", value === true),
              )
            }
          />
          <p>bullying</p>
        </div>
        {showLockedMessage && (
          <p className="text-primary text-sm">
            please exit the show to change your preferences
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <h2>filter method</h2>
        <div className="flex gap-2">
          <button
            id="skipButton"
            className={`red-button w-1/3 ${
              filterMethod === "skip" && "bg-accent"
            }`}
            disabled={preferencesLocked}
            onClick={() => setFilterMethod("skip")}
          >
            skip
          </button>
          <button
            id="muteButton"
            className={`red-button w-1/3 ${
              filterMethod === "mute" && "bg-accent"
            }`}
            disabled={preferencesLocked}
            onClick={() => setFilterMethod("mute")}
          >
            mute
          </button>
          <button
            id="bleepButton"
            className={`red-button w-1/3 ${
              filterMethod === "bleep" && "bg-accent"
            }`}
            disabled={preferencesLocked}
            onClick={() => setFilterMethod("bleep")}
          >
            bleep
          </button>
        </div>
      </div>
      {isWatchPage && (
        <div className="flex items-center justify-between">
          <h2>show comments section</h2>
          <Switch
            checked={showComments}
            onCheckedChange={(value) => setShowComments(value)}
          />
        </div>
      )}
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
