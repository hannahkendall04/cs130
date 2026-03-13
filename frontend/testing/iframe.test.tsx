import React from "react";
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { IframeApp } from "../src/iframe";

const makeChromeMock = () => ({
  storage: {
    local: {
      set: vi.fn((_data, cb) => cb && cb()),
    },
  },
});

describe("iframe comments UI", () => {
  beforeEach(() => {
    global.chrome = makeChromeMock();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows empty state before any comments arrive", () => {
    render(<IframeApp />);
    expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
  });

  it("renders comments sent via window postMessage", async () => {
    render(<IframeApp />);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "FLIXTRA_COMMENTS",
          comments: [
            { _id: "1", startTime: "0", user: "Jen", comment: "Hi" },
            { _id: "2", startTime: "75.2", user: "Alex", comment: "Hello!" },
          ],
        },
      }),
    );

    expect(await screen.findByText("Jen")).toBeInTheDocument();
    expect(screen.getByText("Hi")).toBeInTheDocument();
    expect(screen.getByText("0:00")).toBeInTheDocument();

    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("Hello!")).toBeInTheDocument();
    expect(screen.getByText("1:15")).toBeInTheDocument();
  });

  it("posts a comment on Enter (without Shift), saves to chrome storage, and clears the textbox", () => {
    render(<IframeApp />);

    const textbox = screen.getByRole("textbox");
    fireEvent.change(textbox, { target: { value: "Great scene" } });

    fireEvent.keyDown(textbox, { key: "Enter" });

    const setSpy = vi.mocked(global.chrome.storage.local.set);
    expect(setSpy).toHaveBeenCalledWith({
      commentData: { comment: "Great scene" },
    });
    expect(textbox).toHaveValue("");
  });

  it("does not post on Shift+Enter (allows newline)", () => {
    render(<IframeApp />);

    const textbox = screen.getByRole("textbox");
    fireEvent.change(textbox, { target: { value: "Line 1" } });
    fireEvent.keyDown(textbox, { key: "Enter", shiftKey: true });

    const setSpy = vi.mocked(global.chrome.storage.local.set);
    expect(setSpy).not.toHaveBeenCalled();
    expect(textbox).toHaveValue("Line 1");
  });

  it("prevents posting whitespace-only comments (Enter and button are blocked)", () => {
    render(<IframeApp />);

    const textbox = screen.getByRole("textbox");
    const postButton = screen.getByRole("button", { name: /post comment/i });

    fireEvent.change(textbox, { target: { value: "   \n " } });
    expect(postButton).toBeDisabled();

    fireEvent.keyDown(textbox, { key: "Enter" });
    const setSpy = vi.mocked(global.chrome.storage.local.set);
    expect(setSpy).not.toHaveBeenCalled();
    expect(textbox).toHaveValue("   \n ");
  });
});

