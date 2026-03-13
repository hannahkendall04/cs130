import { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { ArrowUp } from "lucide-react";
import Comment from "./components/Comment";
import "./App.css";

function formatTime(seconds: string) {
  const s = Math.floor(parseFloat(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function IframeApp() {
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<any[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  const handlePost = () => {
    if (!comment.trim()) return;
    chrome.storage.local.set({
      commentData: {
        comment: comment,
      },
    });
    setComment("");
  };

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "FLIXTRA_COMMENTS") setComments(e.data.comments);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // When comments update, scroll to bottom so new comments are visible
  useEffect(() => {
    if (comments.length > 0 && listRef.current) {
      const el = listRef.current;
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight - el.clientHeight;
      });
    }
  }, [comments]);

  return (
    <div className="bg-background border-l-muted box-border grid h-screen grid-rows-[auto_minmax(0,1fr)_auto] gap-2.5 border-l-2 text-white">
      <h1 className="pt-4 pb-2 text-center">comments</h1>
      <div
        ref={listRef}
        className="flex min-h-0 flex-col gap-3 overflow-y-auto"
      >
        {comments.length === 0 ? (
          <p className="text-muted-foreground px-4 text-sm">no comments yet</p>
        ) : (
          comments.map((c) => (
            <Comment
              key={c._id}
              timestamp={formatTime(c.startTime)}
              name={c.user}
              content={c.comment}
            />
          ))
        )}
      </div>
      <div className="flex w-full items-center gap-3 px-4 pt-2 pb-4">
        <textarea
          placeholder="write a comment..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handlePost();
            }
          }}
          className="bg-card text-foreground focus:border-ring border-muted w-full resize-none rounded border p-3 text-sm outline-none"
        />
        <button
          type="button"
          aria-label="post comment"
          disabled={!comment.trim()}
          onClick={handlePost}
          className="bg-primary hover:bg-accent disabled:opacity-50 disabled:hover:bg-primary flex items-center justify-between rounded-full p-1 text-white transition-all duration-300 ease-in-out hover:cursor-pointer disabled:hover:cursor-not-allowed"
        >
          <ArrowUp size={20} />
        </button>
      </div>
    </div>
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(<IframeApp />);
}
