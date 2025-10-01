"use client";

import { Button } from "@/components/ui/button";
import { SignInButton, SignOutButton, SignUpButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Plus } from "lucide-react";
import TooltipCredits from "@/app/components/creditsButton";
import { usePathname } from "next/navigation";

type NavigationProps = {
  credits?: number;
}

const Navigation = ({ credits }: NavigationProps) => {
  const { user, isLoaded } = useUser();
  const pathname = usePathname();

  // Don't show navigation on auth pages, pricing, success, cancel pages
  const excludedRoutes = ['/sign-in', '/sign-up', '/pricing', '/success', '/cancel'];
  if (excludedRoutes.some(route => pathname?.startsWith(route))) {
    return null;
  }

  if (!isLoaded) {
    return null;
  }

  // Button style constants for better maintainability
  const gradientButtonClass = "bg-gradient-to-br hover:opacity-80 text-white rounded-full from-[#3352CC] to-[#1C2D70] font-medium cursor-pointer text-sm sm:text-base px-3 sm:px-4";
  const outlineButtonClass = "bg-black border border-gray-400 text-white rounded-full hover:bg-gray-900 transition-colors duration-150 cursor-pointer text-sm sm:text-base px-3 sm:px-4";

  return (
    <nav className="flex justify-end items-center gap-2 mr-4 sm:mr-7 mt-5 px-4 sm:px-0">
      {!user ? (
        <>
          <SignInButton>
            <Button className={outlineButtonClass}>
              Sign In
            </Button>
          </SignInButton>
          <SignUpButton>
            <Button className={gradientButtonClass}>
              Sign Up
            </Button>
          </SignUpButton>
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
                <Plus className="h-4 w-4 mr-2" />
                Create New
              </Link>
            </Button>
          )}
          
          {pathname !== '/dashboard' && (
            <Button
              asChild
              className={gradientButtonClass}
            >
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          )}
          
          <SignOutButton>
            <Button className={outlineButtonClass}>
              Sign Out
            </Button>
          </SignOutButton>
        </>
      )}
    </nav>
  );
};

export default Navigation;