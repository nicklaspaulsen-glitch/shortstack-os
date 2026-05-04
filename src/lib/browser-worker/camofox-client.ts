/**
 * CamofoxPage — thin HTTP wrapper around the camofox REST API.
 *
 * Camofox (ghcr.io/jo-inc/camofox-browser) is a Firefox-based anti-detection
 * browser that exposes a REST API instead of Playwright WebSocket. It runs as
 * a Docker sidecar and is a drop-in replacement for local-headless Chromium
 * when fingerprint evasion matters (scraping, competitive research, ad
 * verification, etc.).
 *
 * When CAMOFOX_API_URL is set, the Browser Worker replaces its Playwright
 * Page with a CamofoxPage. All tool calls (click, type, navigate, scroll,
 * extract, screenshot) are proxied to the camofox REST API instead.
 *
 * Camofox REST API (v1.8.0):
 *   POST   /sessions                      → { sessionId }
 *   DELETE /sessions/:id                  → void
 *   POST   /sessions/:id/navigate         → void
 *   POST   /sessions/:id/click            → void
 *   POST   /sessions/:id/fill             → void
 *   POST   /sessions/:id/wait             → void
 *   POST   /sessions/:id/evaluate         → { result }
 *   GET    /sessions/:id/screenshot       → PNG binary
 *   GET    /sessions/:id/snapshot         → { url, title, elements, pageText }
 *
 * If camofox returns a 404 or uses different path prefixes in a future
 * version, set CAMOFOX_API_PREFIX in the environment to override the default.
 */

/** Minimal subset of the Playwright Page API used by agent-loop.ts. */
export interface IPage {
  url(): string;
  title(): Promise<string>;
  goto(url: string, opts?: { waitUntil?: string; timeout?: number }): Promise<void>;
  click(selector: string, opts?: { timeout?: number }): Promise<void>;
  fill(selector: string, value: string, opts?: { timeout?: number }): Promise<void>;
  waitForSelector(
    selector: string,
    opts?: { state?: string; timeout?: number },
  ): Promise<void>;
  screenshot(opts?: { fullPage?: boolean; type?: string }): Promise<Buffer>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evaluate<T>(fn: ((...args: any[]) => T) | string, ...args: unknown[]): Promise<T>;
  $eval<T>(selector: string, fn: (el: Element) => T): Promise<T>;
}

interface CamofoxSnapshot {
  url: string;
  title: string;
  elements: Array<{
    index: number;
    tag: string;
    selector: string;
    text: string;
    role?: string;
    type?: string;
    placeholder?: string;
    visible: boolean;
  }>;
  pageText: string;
}

/**
 * Manages a single camofox browser session over HTTP.
 *
 * Usage:
 *   const page = await CamofoxPage.create(process.env.CAMOFOX_API_URL!);
 *   await page.goto("https://example.com");
 *   const buf = await page.screenshot();
 *   await page.close();
 */
export class CamofoxPage implements IPage {
  private sessionId: string;
  private _url = "about:blank";
  private _title = "";

  private constructor(
    private readonly baseUrl: string,
    sessionId: string,
  ) {
    this.sessionId = sessionId;
  }

  /** Create a new camofox session. Throws if the server is unreachable. */
  static async create(baseUrl: string): Promise<CamofoxPage> {
    const url = baseUrl.replace(/\/$/, "");
    const res = await fetch(`${url}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ width: 1366, height: 768 }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `[camofox] failed to create session: HTTP ${res.status} — ${body}`,
      );
    }
    const data = (await res.json()) as { sessionId?: string; id?: string };
    const sessionId = data.sessionId ?? data.id;
    if (!sessionId) {
      throw new Error(
        "[camofox] session creation response missing sessionId field",
      );
    }
    return new CamofoxPage(url, sessionId);
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private get sessionUrl(): string {
    return `${this.baseUrl}/sessions/${this.sessionId}`;
  }

  private async post<T = void>(
    path: string,
    body: Record<string, unknown> = {},
  ): Promise<T> {
    const res = await fetch(`${this.sessionUrl}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `[camofox] ${path} failed: HTTP ${res.status} — ${text}`,
      );
    }
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      return (await res.json()) as T;
    }
    return undefined as T;
  }

  // ── IPage implementation ──────────────────────────────────────────────────

  url(): string {
    return this._url;
  }

  async title(): Promise<string> {
    return this._title;
  }

  async goto(
    url: string,
    _opts?: { waitUntil?: string; timeout?: number },
  ): Promise<void> {
    await this.post("navigate", { url });
    this._url = url;
    // Sync title from snapshot lazily (next screenshot/snapshot call).
  }

  async click(selector: string, _opts?: { timeout?: number }): Promise<void> {
    await this.post("click", { selector });
  }

  async fill(
    selector: string,
    value: string,
    _opts?: { timeout?: number },
  ): Promise<void> {
    await this.post("fill", { selector, value });
  }

  async waitForSelector(
    selector: string,
    opts?: { state?: string; timeout?: number },
  ): Promise<void> {
    await this.post("wait", {
      selector,
      state: opts?.state ?? "visible",
      timeout: opts?.timeout ?? 10000,
    });
  }

  async screenshot(_opts?: {
    fullPage?: boolean;
    type?: string;
  }): Promise<Buffer> {
    const res = await fetch(`${this.sessionUrl}/screenshot`);
    if (!res.ok) {
      throw new Error(
        `[camofox] screenshot failed: HTTP ${res.status}`,
      );
    }
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      // Some camofox builds return base64 in JSON.
      const data = (await res.json()) as { screenshot?: string; data?: string };
      const b64 = data.screenshot ?? data.data ?? "";
      return Buffer.from(b64, "base64");
    }
    // Binary PNG response.
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }

  /**
   * Evaluate JavaScript in the page context via camofox's execute endpoint.
   *
   * Accepts both a function reference and a string expression. String
   * expressions are passed directly; function references are serialised via
   * `.toString()`. A single extra argument (the pattern used by scroll tool
   * calls: `page.evaluate((px) => scrollBy(0, px), amount)`) is inlined via
   * JSON serialisation so the remote browser receives it correctly.
   *
   * Complex closures that capture outer variables will NOT work — camofox
   * executes in the isolated browser context.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async evaluate<T>(fn: ((...args: any[]) => T) | string, ...args: unknown[]): Promise<T> {
    let script: string;
    if (typeof fn === "function") {
      // Inline a single argument via JSON so the remote browser receives it
      // (e.g. `page.evaluate((px) => scrollBy(0, px), 600)` → `((px) => scrollBy(0, px))(600)`).
      if (args.length === 1) {
        script = `(${fn.toString()})(${JSON.stringify(args[0])})`;
      } else {
        script = `(${fn.toString()})()`;
      }
    } else {
      script = fn;
    }
    const result = await this.post<{ result: T; error?: string }>("evaluate", { script });
    if (result?.error) {
      throw new Error(`[camofox] evaluate error: ${result.error}`);
    }
    return result?.result as T;
  }

  /**
   * Evaluate a function against a specific DOM element.
   * Serialised as `document.querySelector("<selector>")` + fn body.
   */
  async $eval<T>(
    selector: string,
    fn: (el: Element) => T,
  ): Promise<T> {
    const script = `(function(){const el=document.querySelector(${JSON.stringify(selector)});if(!el)return null;return (${fn.toString()})(el);})()`;
    return this.evaluate<T>(script);
  }

  // ── Camofox-native snapshot (bypasses JS injection, better anti-detect) ──

  /**
   * Fetch a structured DOM snapshot from camofox's native endpoint.
   * This is more reliable than page.evaluate()-based extraction because it
   * reads the accessibility tree server-side without injecting JS.
   */
  async getSnapshot(): Promise<CamofoxSnapshot> {
    const res = await fetch(`${this.sessionUrl}/snapshot`);
    if (!res.ok) {
      throw new Error(`[camofox] snapshot failed: HTTP ${res.status}`);
    }
    const data = (await res.json()) as CamofoxSnapshot & {
      currentUrl?: string;
      pageTitle?: string;
      interactable?: CamofoxSnapshot["elements"];
      bodyText?: string;
    };
    // Normalise across minor API shape variations.
    this._url = data.url ?? data.currentUrl ?? this._url;
    this._title = data.title ?? data.pageTitle ?? "";
    return {
      url: this._url,
      title: this._title,
      elements: data.elements ?? data.interactable ?? [],
      pageText: data.pageText ?? data.bodyText ?? "",
    };
  }

  /** Close the session and free server-side resources. */
  async close(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/sessions/${this.sessionId}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("[camofox] session close failed", err);
    }
  }
}
