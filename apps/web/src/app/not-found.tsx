import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="notFound">
      <div>
        <b>4</b>
        <span>🍓</span>
        <b>4</b>
      </div>
      <h1>We are sorry,</h1>
      <p>but the page you were looking for can&apos;t be found.</p>
      <Link className="button" href="/main">
        Back to recipes
      </Link>
    </main>
  );
}
