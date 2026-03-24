import { auth } from "@clerk/nextjs/server";
import { HomeIcon, MailIcon, SettingsIcon, TerminalIcon, ZapIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserButton } from "@clerk/nextjs";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, has } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  // TODO: get the user from the db or create the user in the db
  // const clerkUser = await currentUser();

  const isPaidUser = has({ plan: "pro_plan" });

  const navItems = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: HomeIcon,
    },
    {
      label: "Monitoring",
      href: "/monitoring",
      icon: MailIcon,
    },
    {
      label: "Settings",
      href: "/settings",
      icon: SettingsIcon,
    },
    {
      label: "AI Console",
      href: "/console",
      icon: TerminalIcon,
    },
  ];

  return (
    <div className="layout-wrapper">
      <aside className="sidebar-container">
        <div className="sidebar-inner">
          <div className="logo-container">
            <Link href="/">
              <span className="logo-text">ExecOS</span>
            </Link>
          </div>
          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button variant="ghost" className="sidebar-nav-button">
                  <item.icon className="sidebar-nav-icon" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>
          {!isPaidUser && (
            <div className="sidebar-section">
              <div className = 'upgarde-card'>
                <div className = 'upgrade-card-header'>
                    |
                    <ZapIcon className='sidebar-icon'/>
                    <span className='upgrade-card-title'>Upgrade to Pro</span>
                </div>
                <p className='upgrade-card-description'>Get access to premium features and priority support.</p>
                <Button variant='secondary' className='w-full' asChild>
                  <Link href="/pricing">
                    Upgrade Now
                  </Link>
                </Button>
              </div>
            </div>
          )}
          <div className = 'sidebar-section'>
            <div className = 'user-profile'>
                <UserButton />
                {isPaidUser && 
                    <Badge>Pro</Badge>
                }
            </div>
        </div>
        </div>
      </aside>
      <main className="main-content">
        <div className="main-content-inner">{children}</div>
      </main>
    </div>
  );
}
