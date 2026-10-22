import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="MSWorx Practice Bot home">
        <Image
          src="/msworx-logo.png"
          alt="MSWorx Learning"
          width={64}
          height={64}
          className="brand-logo"
          priority
        />
        <span className="product-name">Practice Bot</span>
      </Link>
      <span className="header-caption">
        Build skills through better conversations.
      </span>
      <Link className="mode-tag" href="/scenarios">
        Scenario library
      </Link>
    </header>
  );
}
