import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import App from "../src/App";

// Minimal stubs for chrome APIs used in App
const makeChromeMock = () => ({
  storage: {
    local: {
      get: vi.fn((_keys, cb) =>
        cb({
          filterMethod: "skip",
          pgifyActive: false,
          showComments: false,
          displayName: "",
          enabledFilters: [
            "profanity",
            "sexual_content",
            "substance_use",
            "violence",
            "bullying",
          ],
        }),
      ),
      set: vi.fn((_data, cb) => cb && cb()),
    },
    session: {
      set: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn((_query, cb) =>
      cb([
        {
          id: 1,
          url: "https://www.netflix.com/browse", // not a watch page by default
        },
      ]),
    ),
    sendMessage: vi.fn((_tabId, _msg, cb) => cb && cb()),
  },
  runtime: {
    sendMessage: vi.fn(() => Promise.resolve()),
    lastError: undefined,
  },
});

const setup = () => {
  global.chrome = makeChromeMock();
  return render(<App />);
};

describe("App", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders heading and default display name placeholder", async () => {
    setup();

    expect(await screen.findByText(/flixtra/i)).toBeInTheDocument();
    expect(screen.getByText(/lorem ipsum/i)).toBeInTheDocument();
  });

  it("allows editing and saving the display name via button click", async () => {
    setup();

    // click edit icon
    const editButton = await screen.findByRole("button", {
      name: /edit display name/i,
    });
    fireEvent.click(editButton);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Alex" } });

    // click the check icon to save
    const saveButton = screen.getByRole("button", {
      name: /save display name/i,
    });
    fireEvent.click(saveButton);

    expect(screen.getByText("Alex")).toBeInTheDocument();
  });

  it("cycles filter method when clicking skip/mute/bleep buttons", async () => {
    setup();

    const skipButton = await screen.findByRole("button", { name: /skip/i });
    const muteButton = screen.getByRole("button", { name: /mute/i });
    const bleepButton = screen.getByRole("button", { name: /bleep/i });

    fireEvent.click(muteButton);
    expect(muteButton.className).toContain("bg-accent");

    fireEvent.click(bleepButton);
    expect(bleepButton.className).toContain("bg-accent");

    fireEvent.click(skipButton);
    expect(skipButton.className).toContain("bg-accent");
  });

  it("toggles pg-ify switch and saves preferences", async () => {
    setup();

    const pgSwitch = await screen.findByRole("switch", { name: /pg-ify/i });
    const saveButton = screen.getByRole("button", { name: /save/i });

    // toggle pg-ify
    fireEvent.click(pgSwitch);

    const closeSpy = vi.spyOn(window, "close").mockImplementation(() => {});

    fireEvent.click(saveButton);

    expect(closeSpy).toHaveBeenCalled();

    closeSpy.mockRestore();
  });

  it("does not crash with missing/partial storage data and keeps defaults", async () => {
    const chromeMock = makeChromeMock();
    chromeMock.storage.local.get = vi.fn((_keys, cb) => cb({}));
    global.chrome = chromeMock;

    render(<App />);

    const skipButton = await screen.findByRole("button", { name: /skip/i });
    expect(skipButton.className).toContain("bg-accent");
    expect(screen.getByText(/lorem ipsum/i)).toBeInTheDocument();
  });

  it("does not send show-comments message if active tab id is missing", async () => {
    const chromeMock = makeChromeMock();
    chromeMock.tabs.query = vi.fn((_query, cb) =>
      cb([{ url: "https://www.netflix.com/watch/80217615" } as any]),
    );
    global.chrome = chromeMock;

    render(<App />);

    // show comments toggle appears on watch page
    const commentsSwitch = await screen.findByRole("switch", {
      name: /show comments section/i,
    });
    fireEvent.click(commentsSwitch);

    const sendMessage = vi.mocked(chromeMock.tabs.sendMessage);
    const closeSpy = vi.spyOn(window, "close").mockImplementation(() => {});

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(sendMessage).not.toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();

    closeSpy.mockRestore();
  });

  it("shows blur toggle only when filter method is not skip", async () => {
    setup();

    // default is skip, so blur switch should be absent
    expect(screen.queryByRole("switch", { name: /blur video/i })).toBeNull();

    const muteButton = await screen.findByRole("button", { name: /mute/i });
    fireEvent.click(muteButton);

    expect(
      await screen.findByRole("switch", { name: /blur video/i }),
    ).toBeInTheDocument();
  });

  it("shows locked message when preferences are locked and user tries to change", async () => {
    // set active tab to a watch URL so preferencesLocked = true
    const chromeMock = makeChromeMock();
    chromeMock.tabs.query = vi.fn((_query, cb) =>
      cb([
        {
          id: 1,
          url: "https://www.netflix.com/watch/123456",
        },
      ]),
    );
    global.chrome = chromeMock;

    render(<App />);

    const pgSwitch = await screen.findByRole("switch", { name: /pg-ify/i });

    fireEvent.click(pgSwitch);

    expect(
      await screen.findByText(
        /please exit the show to change your preferences/i,
      ),
    ).toBeInTheDocument();
  });

  it("shows the show comments section toggle when on a Netflix watch page", async () => {
    const chromeMock = makeChromeMock();
    chromeMock.tabs.query = vi.fn((_query, cb) =>
      cb([
        {
          id: 1,
          url: "https://www.netflix.com/watch/80217615",
        },
      ]),
    );
    global.chrome = chromeMock;

    render(<App />);

    expect(
      await screen.findByRole("switch", { name: /show comments section/i }),
    ).toBeInTheDocument();
  });

  it("reflects show comments state: when on, switch is checked; when off, switch is unchecked and save sends correct value", async () => {
    // Initially showComments is false from storage
    const chromeMock = makeChromeMock();
    chromeMock.tabs.query = vi.fn((_query, cb) =>
      cb([
        { id: 1, url: "https://www.netflix.com/watch/80217615" },
      ]),
    );
    global.chrome = chromeMock;

    render(<App />);

    const commentsSwitch = await screen.findByRole("switch", {
      name: /show comments section/i,
    });
    expect(commentsSwitch).toHaveAttribute("data-state", "unchecked");

    // Turn on show comments
    fireEvent.click(commentsSwitch);
    expect(commentsSwitch).toHaveAttribute("data-state", "checked");

    // Save and verify the message sent to tab has showComments: true
    const sendMessage = vi.mocked(chromeMock.tabs.sendMessage);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const closeSpy = vi.spyOn(window, "close").mockImplementation(() => {});

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(sendMessage).toHaveBeenCalledWith(
      1,
      { type: "FLIXTRA_SET_SHOW_COMMENTS", showComments: true },
      expect.any(Function),
    );

    alertSpy.mockRestore();
    closeSpy.mockRestore();
  });

  it("when show comments is off and user saves, sends showComments: false so comments section is not shown", async () => {
    const chromeMock = makeChromeMock();
    chromeMock.tabs.query = vi.fn((_query, cb) =>
      cb([{ id: 1, url: "https://www.netflix.com/watch/80217615" }]),
    );
    global.chrome = chromeMock;

    render(<App />);

    const commentsSwitch = await screen.findByRole("switch", {
      name: /show comments section/i,
    });
    expect(commentsSwitch).toHaveAttribute("data-state", "unchecked");

    const sendMessage = vi.mocked(chromeMock.tabs.sendMessage);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const closeSpy = vi.spyOn(window, "close").mockImplementation(() => {});

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(sendMessage).toHaveBeenCalledWith(
      1,
      { type: "FLIXTRA_SET_SHOW_COMMENTS", showComments: false },
      expect.any(Function),
    );

    alertSpy.mockRestore();
    closeSpy.mockRestore();
  });
});
