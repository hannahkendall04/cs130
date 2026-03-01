import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { ArrowUp } from "lucide-react";
import "./App.css";

function App() {
  const [width, setWidth] = useState(400);
  const [dragging, setDragging] = useState(false);
  const [comment, setComment] = useState("");

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
    <div style={{ height: "100%" }}>
      {/* DRAG HANDLE */}
      <div
        onMouseDown={() => setDragging(true)}
        className="absolute top-0 left-0 h-full w-1 cursor-ew-resize bg-[#333]"
      />
      {/* COMMENT SECTION */}
      <div className="bg-background box-border grid h-screen grid-rows-[auto_1fr_auto] gap-2.5 p-4 text-white select-none">
        <h1 className="text-center">comments</h1>
        <h1>actual comments</h1>
        <div className="flex w-full items-center gap-3">
          <textarea
            placeholder="write a comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="bg-card text-foreground focus:border-ring border-muted w-full resize-none rounded border p-3 outline-none"
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
