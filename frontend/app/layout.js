import '../styles/globals.css';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://looqta.com'),
  title: 'Looqta (لقطة) — Smart Price Comparison Platform',
  description: 'Compare prices from Amazon and Noon in real-time. Find the best deals on products in Saudi Arabia. Smart choices for smart shoppers.',
  keywords: 'price comparison, Amazon, Noon, Saudi Arabia, online shopping, best deals, compare prices, لقطة',
  openGraph: {
    title: 'Looqta (لقطة) — Smart Price Comparison Platform',
    description: 'Compare prices from Amazon and Noon in real-time. Find the best deals on products in Saudi Arabia.',
    url: '/',
    siteName: 'Looqta',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Looqta - Price Comparison Platform',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Looqta (لقطة) — Smart Price Comparison Platform',
    description: 'Compare prices from Amazon and Noon in real-time.',
    images: ['/og-image.jpg'],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <meta name="theme-color" content="#6366f1" />
      </head>
      <body className="antialiased">
        <div className="min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
