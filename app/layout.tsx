import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { ClerkProvider, SignInButton, SignUpButton, UserButton, Show } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Executive Assistant",
  description: "Your autonomous AI assistant for managing tasks, scheduling, and more. Powered by GPT-4 and integrated with your calendar and email for seamless productivity.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${montserrat.className} antialiased`}>
        <ClerkProvider appearance={{ theme: shadcn }}>
          
          {children}
         <footer className= 'footer-wrapper'>
          <div className = 'section-heading'>
           <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Your Company. All rights reserved.
           </p>
          </div> 
         </footer> 
        </ClerkProvider>
      </body>
    </html>
  );
}
