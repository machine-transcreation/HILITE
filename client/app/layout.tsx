import Navbar from "@/components/Navbar";
import { UserProvider } from "@/contexts/UserContext";
import { GoogleOAuthProvider } from "@react-oauth/google";
import type { Metadata } from "next";
import { Roboto } from "next/font/google"; 
import "./globals.css";

const roboto = Roboto({ subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "Image Transcreation",
  description: "Image Transcreation Platform",
  icons: {
    icon: '/assets/opennlp_logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;

  if (!clientId) {
    throw new Error("Google OAuth Client ID is missing. Please set NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID in your .env file.");
  }
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/assets/opennlp_logo.png" />
      </head>
      <body className={roboto.className}>
        <GoogleOAuthProvider clientId={clientId}> 
          <UserProvider> 
            <Navbar />
            {children}
          </UserProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}