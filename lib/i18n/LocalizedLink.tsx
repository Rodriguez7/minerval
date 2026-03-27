"use client";

import Link from "next/link";
import { useLocalizedHref } from "./client";

type Props = React.ComponentProps<typeof Link> & {
  href: string;
};

export function LocalizedLink({ href, ...props }: Props) {
  const localizedHref = useLocalizedHref(href);
  return <Link href={localizedHref} {...props} />;
}
