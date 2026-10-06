import Link from "next/link";
import type { ReactNode } from "react";

type ButtonLinkProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "quiet";
  className?: string;
};

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
}: ButtonLinkProps) {
  return (
    <Link className={`button button-${variant} ${className}`.trim()} href={href}>
      {children}
    </Link>
  );
}

export function TextLink({ href, children, className = "" }: ButtonLinkProps) {
  return (
    <Link className={`text-link ${className}`.trim()} href={href}>
      {children}
    </Link>
  );
}
