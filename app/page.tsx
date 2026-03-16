import Image from "next/image";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ClerkProvider, SignInButton, SignUpButton, UserButton, Show } from "@clerk/nextjs";
export default function Home() {
  return (
    <div className="landing-wrapper">
      <div className="landing-header-inner">
       <div className="landing-container">
        <Link href="/">
          <span className = 'logo-text'>ExcelOS
            </span> 
        </Link>

       </div>
      </div>
      
       <header className="flex justify-end gap-2 p-4">
            <Show when="signed-out">
              <SignInButton />
              <SignUpButton />
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </header>
      
    </div>
  );
}
