'use client';
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="errorState">
      <h1>Something went wrong</h1>
      <p>The kitchen had a small mishap. Please try again.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
