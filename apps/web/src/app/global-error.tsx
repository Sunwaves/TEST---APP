"use client"; // replaces the root layout when it fails, so it brings its own <html> and plain styles

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#fafaf9", color: "#1c1917", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <main style={{ textAlign: "center", padding: 16 }}>
          <title>Something went wrong</title>
          <h1 style={{ fontSize: 24 }}>Something went wrong</h1>
          <p>Please try again in a moment.</p>
          <button onClick={() => retry()} style={{ marginTop: 16, padding: "8px 16px", borderRadius: 6, background: "#1c1917", color: "#fff", border: 0 }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
