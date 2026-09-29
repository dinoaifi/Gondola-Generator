import "./globals.css";
import { ClerkProvider, UserButton } from "@clerk/nextjs";

export const metadata = {
  title: "Gondola Generator",
  description: "Internal planogram tool",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", padding: "10px 20px", background: "#fff", borderBottom: "1px solid #e5e5e5" }}>
            <UserButton afterSignOutUrl="/" />
          </div>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
