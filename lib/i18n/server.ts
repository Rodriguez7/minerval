import { cookies, headers } from "next/headers";
import {
  LOCALE_COOKIE_NAME,
  LOCALE_HEADER_NAME,
  getPreferredLocale,
  isAppLocale,
  type AppLocale,
} from "./config";
import { getMessages, type Messages } from "./messages";

export async function getRequestLocale(): Promise<AppLocale> {
  const requestHeaders = await headers();
  const headerLocale = requestHeaders.get(LOCALE_HEADER_NAME);

  if (isAppLocale(headerLocale)) {
    return headerLocale;
  }

  const cookieStore = await cookies();
  return getPreferredLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
}

export async function getRequestMessages(): Promise<Messages> {
  return getMessages(await getRequestLocale());
}
