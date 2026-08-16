import type { Metadata } from "next";
import { Big_Shoulders_Display, Manrope, IBM_Plex_Mono, Caveat } from "next/font/google";
import "./globals.css";

const bigShoulders = Big_Shoulders_Display({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-big-shoulders",
});
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-ibm-plex-mono",
});
// Script tagline under the PAR-ker badge on the home page (see
// app/page.tsx) — matches the brush-script "Buddy Trip Golf" look
// from the source logo mockup, rendered as real text instead of
// baked into the image so it can never get cropped/clipped.
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-caveat",
});

export const metadata: Metadata = {
  title: "Buddy Trip Golf",
  description: "Live scoring and games for the trip",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bigShoulders.variable} ${manrope.variable} ${plexMono.variable} ${caveat.variable}`}>
      <body className="font-body">{children}</body>
    </html>
  );
}
