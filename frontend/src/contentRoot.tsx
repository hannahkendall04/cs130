import { createRoot } from "react-dom/client";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import CommentSection from "./components/CommentSection";

function NetflixLayout() {
  return (
    <ResizablePanelGroup className="h-screen w-screen">
      <ResizablePanel defaultSize={75}>
        <div id="flixtra-netflix-mount" className="h-full w-full" />
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={25}>
        <CommentSection />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export function mountFlixtraUI() {
  const container = document.getElementById("flixtra-root");
  const netflixContent = document.getElementById("flixtra-netflix-content");

  if (!container || !netflixContent) return;

  const root = createRoot(container);
  root.render(<NetflixLayout />);

  // Move Netflix content inside left panel
  const mountPoint = document.getElementById("flixtra-netflix-mount");
  if (mountPoint) {
    mountPoint.appendChild(netflixContent);
  }
}
