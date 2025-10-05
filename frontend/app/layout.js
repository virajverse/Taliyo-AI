import "./globals.css";
import { Poppins } from "next/font/google";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata = {
  title: "Taliyo AI",
  description: "Chat with the Taliyo AI assistant",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} font-sans min-h-[100dvh] md:min-h-screen bg-gradient-to-br from-[#0D0D0D] to-[#181818] text-zinc-100 antialiased`}> 
        <div id="__taliyo_root" className="min-h-[100dvh] md:min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
