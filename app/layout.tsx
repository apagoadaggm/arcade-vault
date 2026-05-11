import type { Metadata } from "next";
import "./globals.css";
import { UserProvider } from "./context/UserContext";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Arcade Vault",
  description: "Online gaming platform — play and compete for points",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <UserProvider>
          <Nav />
          {children}
        </UserProvider>
      </body>
    </html>
  );
}
