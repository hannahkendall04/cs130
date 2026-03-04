import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { ArrowUp } from "lucide-react";
import Comment from "./components/Comment";
import "./App.css";

function formatTime(seconds: string) {
  const s = Math.floor(parseFloat(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function App() {
  const [width, setWidth] = useState(400);
  const [dragging, setDragging] = useState(false);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<any[]>([]);

  const handlePost = () => {
    chrome.storage.local.set({
      commentData: {
        comment: comment,
      },
    });
    alert("Posted comment!");
    setComment("");
  };

  useEffect(() => {
    // Tell parent page to resize
    window.parent.postMessage({ type: "FLIXTRA_RESIZE", width }, "*");
  }, [width]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "FLIXTRA_COMMENTS") setComments(e.data.comments);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      console.log("mousemove");
      console.log("mouseup:", dragging);
      if (!dragging) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 250 && newWidth < 800) {
        setWidth(newWidth);
      }
    };

    const stopDragging = () => setDragging(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopDragging);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopDragging);
    };
  }, [dragging]);

  return (
    <div className="h-screen">
      {/* DRAG HANDLE */}
      <div
        onMouseDown={() => setDragging(true)}
        className="absolute top-0 left-0 h-full w-1 cursor-ew-resize bg-[#333]"
      />
      {/* COMMENT SECTION */}
      <div className="bg-background box-border grid h-full grid-rows-[auto_minmax(0,1fr)_auto] gap-2.5 text-white select-none">
        <h1 className="pt-4 pb-2 text-center">comments</h1>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          {comments.length === 0
            ? <p className="px-4 text-sm text-muted-foreground">No comments yet</p>
            : comments.map(c => (
                <Comment key={c._id} timestamp={formatTime(c.startTime)} name={c.user} content={c.comment} />
              ))
          }
        </div>
        <div className="flex w-full items-center gap-3 px-4 pt-2 pb-4">
          <textarea
            placeholder="write a comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="bg-card text-foreground focus:border-ring border-muted w-full resize-none rounded border p-3 text-sm outline-none"
          />
          <div className="bg-primary hover:bg-accent flex items-center justify-between rounded-full p-1 text-white transition-all duration-300 ease-in-out hover:cursor-pointer">
            <ArrowUp onClick={handlePost} size={20} />
          </div>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
