import '../styles/globals.css';

export const metadata = {
  title: 'Looqta (لقطة) — Smart choices',
  description: 'Price comparison for Gulf e-commerce - Compare prices from Amazon and Noon',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
