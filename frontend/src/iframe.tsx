import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { ArrowUp } from "lucide-react";
import "./App.css";

function App() {
  const [width, setWidth] = useState(400);
  const [dragging, setDragging] = useState(false);

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
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "3px",
          height: "100%",
          cursor: "ew-resize",
          background: "#333",
        }}
      />
      {/* COMMENT SECTION */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
          gap: 10,
          padding: 16,
          userSelect: "none",
          height: "100vh",
          boxSizing: "border-box",
        }}
      >
        <h1>comments</h1>
        <h1>actual comments</h1>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            width: "100%",
          }}
        >
          <textarea
            placeholder="Write a comment..."
            style={{
              resize: "none",
              backgroundColor: "#1E1E1E",
              color: "#E5E5E5",
              border: "none",
              borderRadius: 5,
              padding: 12,
              width: "100%",
            }}
          />
          <div
            style={{
              borderRadius: "9999px",
              background: "#E50914",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 4,
            }}
          >
            <ArrowUp color="white" size={20} />
          </div>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
