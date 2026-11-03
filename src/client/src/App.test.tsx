import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

describe("TinyURL dashboard", () => {
  afterEach(cleanup);

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/links") {
          return new Response(
            JSON.stringify({ slug: "abc123", shortUrl: "http://localhost:3000/r/abc123" }),
            { status: 201, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ total: 4 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("creates a short link, shows its analytics, and copies it", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("URL longa"), {
      target: { value: "https://example.com/article" },
    });
    fireEvent.click(screen.getByRole("button", { name: /encurtar/i }));

    expect(await screen.findByText("localhost:3000/r/abc123")).toBeTruthy();
    expect(await screen.findByText("4", { selector: ".clicks-cell" })).toBeTruthy();
    expect(localStorage.getItem("tinyurl-links")).toContain("abc123");

    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("http://localhost:3000/r/abc123");
    });
  });

  it("retains links after remount and refreshes click totals on its polling interval", async () => {
    let pollingCallback: (() => void) | undefined;
    vi.spyOn(window, "setInterval").mockImplementation(((callback: TimerHandler, delay?: number) => {
      if (delay === 5000) pollingCallback = callback as () => void;
      return 1;
    }) as typeof window.setInterval);
    vi.spyOn(window, "clearInterval").mockImplementation(() => undefined);
    let total = 4;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/links") {
          return new Response(
            JSON.stringify({ slug: "abc123", shortUrl: "http://localhost:3000/r/abc123" }),
            { status: 201, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ total }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    const view = render(<App />);
    fireEvent.change(screen.getByLabelText("URL longa"), {
      target: { value: "https://example.com/article" },
    });
    fireEvent.click(screen.getByRole("button", { name: /encurtar/i }));
    expect(await screen.findByText("4", { selector: ".clicks-cell" })).toBeTruthy();
    expect(pollingCallback).toBeTypeOf("function");

    total = 7;
    await act(async () => {
      pollingCallback?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(await screen.findByText("7", { selector: ".clicks-cell" })).toBeTruthy();

    view.unmount();
    render(<App />);
    expect(await screen.findByText("localhost:3000/r/abc123")).toBeTruthy();
  });

  it("shows API validation errors without adding a table row", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "URL inválida" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })),
    );
    render(<App />);
    fireEvent.change(screen.getByLabelText("URL longa"), {
      target: { value: "https://example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /encurtar/i }));

    expect(await screen.findByText("URL inválida")).toBeTruthy();
    expect(screen.queryByText("localhost:3000/r/abc123")).toBeNull();
  });

  it("shows a clear message when the API returns a non-JSON server error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("FUNCTION_INVOCATION_FAILED", {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      })),
    );
    render(<App />);
    fireEvent.change(screen.getByLabelText("URL longa"), {
      target: { value: "https://example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /encurtar/i }));

    expect(await screen.findByText("A API falhou (HTTP 500). Confira os logs da Vercel.")).toBeTruthy();
  });

  it("shows a loading state while link creation is pending", async () => {
    let resolveCreate!: (response: Response) => void;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveCreate = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/links") return pendingResponse;
        return new Response(JSON.stringify({ total: 0 }), { status: 200 });
      }),
    );

    render(<App />);
    fireEvent.change(screen.getByLabelText("URL longa"), {
      target: { value: "https://example.com/pending" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Encurtar" }));
    expect(screen.getByRole("button", { name: "Criando" })).toBeTruthy();

    await act(async () => {
      resolveCreate(new Response(
        JSON.stringify({ slug: "abc123", shortUrl: "http://localhost:3000/r/abc123" }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ));
    });
    expect(await screen.findByText("localhost:3000/r/abc123")).toBeTruthy();
  });
});