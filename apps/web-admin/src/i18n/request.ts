import { getRequestConfig } from 'next-intl/server';
import vi from '../../messages/vi.json';
import en from '../../messages/en.json';

const messages = { vi, en } as const;
type Locale = keyof typeof messages;

export default getRequestConfig(async () => {
  const locale: Locale = 'vi';
  return { locale, messages: messages[locale] };
});
