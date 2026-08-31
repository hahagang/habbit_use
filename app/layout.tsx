import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://good-habits-daily.wuwu6526.chatgpt.site'),
  title: '好习惯｜一天一点，慢慢变好',
  description: '一个简单、安静的每日习惯打卡工具，把想坚持的小事一件件完成。',
  openGraph: {
    title: '好习惯｜一天一点，慢慢变好',
    description: '把想坚持的小事，一件件完成。',
    locale: 'zh_CN',
    type: 'website',
    images: [
      {
        url: 'https://good-habits-daily.wuwu6526.chatgpt.site/og.png',
        width: 1200,
        height: 630,
        alt: '好习惯｜一天一点，慢慢变好',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '好习惯｜一天一点，慢慢变好',
    description: '把想坚持的小事，一件件完成。',
    images: ['https://good-habits-daily.wuwu6526.chatgpt.site/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} antialiased`}>{children}</body>
    </html>
  );
}
