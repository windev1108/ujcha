import { Inter, Open_Sans } from 'next/font/google';

export const fontSans = Inter({
  variable: '--font-sans',
  preload: true,
  style: ['normal', 'italic'],
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});


export const fontSerif = Open_Sans({
  preload: true,
  variable: '--font-serif',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});
