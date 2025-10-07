"use client";

import { Button } from "@/components/ui/button";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { Plus, Video } from "lucide-react";
import TooltipCredits from "@/app/components/creditsButton";
import { usePathname } from "next/navigation";

type NavigationProps = {
  credits?: number;
}

const Navigation = ({ credits }: NavigationProps) => {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // Don't show navigation on auth pages, success, cancel pages
  const excludedRoutes = ['/sign-in', '/sign-up', '/success', '/cancel'];
  if (excludedRoutes.some(route => pathname?.startsWith(route))) {
    return null;
  }

  if (status === "loading") {
    return null;
  }

  // Button style constants for better maintainability
  const gradientButtonClass = [
    "bg-gradient-to-br hover:opacity-80 text-white rounded-full",
    "from-[#3352CC] to-[#1C2D70] font-medium cursor-pointer",
    "text-xs sm:text-sm lg:text-base px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2"
  ].join(" ");
  const outlineButtonClass = [
    "bg-black border border-gray-400 text-white rounded-full",
    "hover:bg-gray-900 transition-colors duration-150 cursor-pointer",
    "text-xs sm:text-sm lg:text-base px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2"
  ].join(" ");

  return (
    <nav className="flex justify-between items-center gap-4 px-4 sm:px-6 lg:px-8 py-4">
      {/* Logo and Title */}
      <Link href="/dashboard" className="flex items-center gap-2 sm:gap-3 text-white hover:opacity-80 transition-opacity" aria-label="Home - ShortsApp Dashboard">
        <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-[#3352CC] to-[#1C2D70] rounded-lg">
          <Video className="h-4 w-4 sm:h-5 sm:w-5 text-white" aria-hidden="true" />
        </div>
        <span className="font-bold text-base sm:text-lg lg:text-xl text-gray-900 dark:text-white hidden sm:block">ShortsApp</span>
      </Link>

      {/* Navigation buttons */}
      <div className="flex items-center gap-1 sm:gap-2">
        {!session?.user ? (
        <>
          <Button 
            asChild
            className={outlineButtonClass}
          >
            <Link href="/sign-in">
              Sign In
            </Link>
          </Button>
          <Button 
            asChild
            className={gradientButtonClass}
          >
            <Link href="/sign-up">
              Sign Up
            </Link>
          </Button>
        </>
      ) : (
        <>
          {credits !== undefined && <TooltipCredits credits={credits} />}
          
          {pathname !== '/new' && (
            <Button
              asChild
              className={gradientButtonClass}
            >
              <Link href="/new">
                <Plus className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Create New</span>
                <span className="sm:hidden">New</span>
              </Link>
            </Button>
          )}
          
          {pathname !== '/dashboard' && (
            <Button
              asChild
              className={gradientButtonClass}
            >
              <Link href="/dashboard">
                <span className="hidden sm:inline">Dashboard</span>
                <span className="sm:hidden">Dash</span>
              </Link>
            </Button>
          )}
          
          <Button 
            className={outlineButtonClass}
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            Sign Out
          </Button>
        </>
      )}
      </div>
    </nav>
  );
};

export default Navigation;