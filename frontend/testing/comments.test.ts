import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

type ChromeMock = {
  storage: {
    local: {
      get: (keys: any, cb: (data: any) => void) => void;
      set: (data: any, cb?: () => void) => void;
      remove: (key: string, cb?: () => void) => void;
    };
    onChanged: {
      addListener: (cb: (changes: any) => void) => void;
    };
  };
  runtime: {
    getURL: (path: string) => string;
    lastError?: any;
    onMessage: { addListener: (cb: (msg: any) => void) => void };
  };
};

let onChangedListener: ((changes: any) => void) | null = null;
let onMessageListener: ((msg: any) => void) | null = null;

function setNetflixLocation(trackId: string) {
  Object.defineProperty(window, "location", {
    value: {
      href: `https://www.netflix.com/watch/${trackId}`,
      pathname: `/watch/${trackId}`,
    },
    writable: true,
  });
}

function makeChromeMock(initial: {
  showComments: boolean;
  displayName?: string;
  commentData?: { comment?: string };
}): ChromeMock {
  return {
    storage: {
      local: {
        get: vi.fn((_keys, cb) =>
          cb({
            commentData: initial.commentData,
            showComments: initial.showComments,
            displayName: initial.displayName ?? "",
          }),
        ),
        set: vi.fn((_data, cb) => cb && cb()),
        remove: vi.fn((_key, cb) => cb && cb()),
      },
      onChanged: {
        addListener: vi.fn((cb) => {
          onChangedListener = cb;
        }),
      },
    },
    runtime: {
      getURL: vi.fn((p) => `chrome-extension://id/${p}`),
      lastError: undefined,
      onMessage: {
        addListener: vi.fn((cb) => {
          onMessageListener = cb;
        }),
      },
    },
  };
}

async function importFreshCommentsScript() {
  vi.resetModules();
  onChangedListener = null;
  onMessageListener = null;

  // Execute the injected content script as a plain script, like Chrome would,
  // instead of importing it as an ES module (it's copied from /public).
  const scriptPath = path.resolve(__dirname, "../public/comments.js");
  const code = readFileSync(scriptPath, "utf8");
  // eslint-disable-next-line no-eval
  eval(code);
}

describe("injected comments script (comments.js)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
    // ensure at least one layout target exists so body class + styles apply
    const appMountPoint = document.createElement("div");
    appMountPoint.id = "appMountPoint";
    document.body.appendChild(appMountPoint);

    // Avoid crashes from getComputedStyle in jsdom
    vi.spyOn(window, "getComputedStyle").mockImplementation((() => {
      return { position: "static" } as any;
    }) as any);

    // Default to watch page
    setNetflixLocation("123456");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    // best-effort cleanup for intervals created by the script
    vi.clearAllTimers();
    document.body.innerHTML = "";
    delete (globalThis as any).chrome;
    delete (globalThis as any).fetch;
  });

  it("does not inject the iframe when showComments is false", async () => {
    global.chrome = makeChromeMock({ showComments: false });
    global.fetch = vi.fn();

    await importFreshCommentsScript();
    vi.runOnlyPendingTimers();

    expect(document.getElementById("flixtra-iframe")).toBeNull();
    expect(document.body.classList.contains("flixtra-comments-visible")).toBe(
      false,
    );
  });

  it("injects the iframe + applies layout when showComments is true on a watch page", async () => {
    global.chrome = makeChromeMock({ showComments: true });
    global.fetch = vi.fn();

    await importFreshCommentsScript();
    vi.runOnlyPendingTimers();

    const iframe = document.getElementById(
      "flixtra-iframe",
    ) as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute("src")).toContain("iframe.html");
    expect(document.body.classList.contains("flixtra-comments-visible")).toBe(
      true,
    );
  });

  it("removes iframe when receiving FLIXTRA_SET_SHOW_COMMENTS false", async () => {
    global.chrome = makeChromeMock({ showComments: true });
    global.fetch = vi.fn();

    await importFreshCommentsScript();
    vi.runOnlyPendingTimers();

    expect(document.getElementById("flixtra-iframe")).toBeTruthy();

    onMessageListener?.({
      type: "FLIXTRA_SET_SHOW_COMMENTS",
      showComments: false,
    });
    vi.runOnlyPendingTimers();

    expect(document.getElementById("flixtra-iframe")).toBeNull();
  });

  it("on commentData change with a video present, posts comment and clears commentData", async () => {
    global.chrome = makeChromeMock({ showComments: true, displayName: "Jen" });

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/post_comment")) {
        return {
          ok: true,
          json: async () => ({ ok: true }),
        } as any;
      }
      if (url.includes("/get_comments")) {
        return {
          ok: true,
          json: async () => ({
            comments: [
              {
                _id: "c1",
                user: "Jen",
                showId: "123456",
                comment: "wow",
                startTime: "10",
                endTime: "25",
              },
            ],
          }),
        } as any;
      }
      throw new Error(`unexpected url: ${url}`);
    });
    global.fetch = fetchMock as any;

    // video element drives currentTime + commentStartTime
    const video = document.createElement("video") as any;
    Object.defineProperty(video, "currentTime", { value: 10, writable: true });
    document.body.appendChild(video);

    await importFreshCommentsScript();

    await onChangedListener?.({
      commentData: { newValue: { comment: "wow" } },
    });

    // post_comment called with expected payload
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/post_comment"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Accept: "application/json",
          "Content-Type": "application/json",
        }),
        body: expect.any(String),
      }),
    );

    const postCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes("/post_comment"),
    ) as any[] | undefined;
    const postBody = JSON.parse(
      ((postCall?.[1] as any)?.body as string | undefined) ?? "{}",
    );
    expect(postBody).toMatchObject({
      user: "Jen",
      showId: "123456",
      comment: "wow",
      startTime: "10",
      endTime: "25",
    });

    // commentData cleared
    expect(vi.mocked(global.chrome.storage.local.remove)).toHaveBeenCalledWith(
      "commentData",
      expect.any(Function),
    );
  });

  it("does not call post_comment when comment is empty, but still clears commentData", async () => {
    global.chrome = makeChromeMock({ showComments: true });
    const fetchMock = vi.fn();
    global.fetch = fetchMock as any;

    const video = document.createElement("video") as any;
    Object.defineProperty(video, "currentTime", { value: 3, writable: true });
    document.body.appendChild(video);

    await importFreshCommentsScript();

    await onChangedListener?.({
      commentData: { newValue: { comment: "" } },
    });

    // get_comments may still be called by the visibility sync; we only care that
    // post_comment is NOT called when the comment is empty.
    expect(
      fetchMock.mock.calls.some((c) =>
        String(c[0]).includes("/post_comment"),
      ),
    ).toBe(false);
    expect(vi.mocked(global.chrome.storage.local.remove)).toHaveBeenCalledWith(
      "commentData",
      expect.any(Function),
    );
  });

  it("logs an error when post_comment fails (non-OK response)", async () => {
    global.chrome = makeChromeMock({ showComments: true });

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn(async (url: string) => {
      if (url.includes("/post_comment")) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ detail: "boom" }),
        } as any;
      }
      return { ok: true, json: async () => ({ comments: [] }) } as any;
    }) as any;

    const video = document.createElement("video") as any;
    Object.defineProperty(video, "currentTime", { value: 1, writable: true });
    document.body.appendChild(video);

    await importFreshCommentsScript();

    await onChangedListener?.({
      commentData: { newValue: { comment: "x" } },
    });

    expect(errorSpy).toHaveBeenCalled();
    expect(vi.mocked(global.chrome.storage.local.remove)).toHaveBeenCalledWith(
      "commentData",
      expect.any(Function),
    );
  });
});
