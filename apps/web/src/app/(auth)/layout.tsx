export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="authPage">
      <div className="authIllustration">
        <span>🥬</span>
        <span>🍅</span>
        <span>🥑</span>
      </div>
      {children}
    </main>
  );
}
