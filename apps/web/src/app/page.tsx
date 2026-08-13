import Image from 'next/image';
import Link from 'next/link';
export default function WelcomePage() {
  return (
    <main className="welcome">
      <div className="welcomeArt">
        <Image
          src="/figma/hero-04.png"
          alt="Fresh vegetable bowl"
          fill
          priority
          sizes="(max-width: 767px) 75vw, 520px"
        />
      </div>
      <div className="welcomeCopy">
        <div className="mark">Y</div>
        <h1>Welcome to the app!</h1>
        <p>
          This app offers more than just a collection of recipes — it is designed to be your very
          own digital cookbook.
        </p>
        <div>
          <Link className="button" href="/register">
            Registration
          </Link>
          <Link className="button buttonOutline" href="/signin">
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
