export function PageTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="pageTitle">
      <i />
      <span>{children}</span>
    </h1>
  );
}
