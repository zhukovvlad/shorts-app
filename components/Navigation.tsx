"use client";

import { Button } from "@/components/ui/button";
import { SignInButton, SignOutButton, SignUpButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Plus } from "lucide-react";
import TooltipCredits from "@/app/components/creditsButton";
import { usePathname } from "next/navigation";

interface NavigationProps {
  credits?: number;
}

const Navigation = ({ credits }: NavigationProps) => {
  const { user, isLoaded } = useUser();
  const pathname = usePathname();

  // Don't show navigation on auth pages, pricing, success, cancel pages
  if (pathname?.includes('/sign-in') || 
      pathname?.includes('/sign-up') || 
      pathname === '/pricing' || 
      pathname === '/success' || 
      pathname === '/cancel') {
    return null;
  }

  if (!isLoaded) {
    return null;
  }

  return (
    <nav className="flex justify-end items-center gap-2 mr-4 sm:mr-7 mt-5 px-4 sm:px-0">
      {!user ? (
        <>
          <SignInButton>
            <Button className="bg-black border border-gray-400 text-white rounded-full hover:bg-gray-900 transition-colors duration-150 cursor-pointer text-sm sm:text-base px-3 sm:px-4">
              Sign In
            </Button>
          </SignInButton>
          <SignUpButton>
            <Button className="bg-gradient-to-br hover:opacity-80 text-white rounded-full from-[#3352CC] to-[#1C2D70] font-medium cursor-pointer text-sm sm:text-base px-3 sm:px-4">
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
              className="bg-gradient-to-br hover:opacity-80 text-white rounded-full from-[#3352CC] to-[#1C2D70] font-medium cursor-pointer text-sm sm:text-base px-3 sm:px-4"
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
              className="bg-gradient-to-br hover:opacity-80 text-white rounded-full from-[#3352CC] to-[#1C2D70] font-medium cursor-pointer text-sm sm:text-base px-3 sm:px-4"
            >
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          )}
          
          <SignOutButton>
            <Button className="bg-black border border-gray-400 text-white rounded-full hover:bg-gray-900 transition-colors duration-150 cursor-pointer text-sm sm:text-base px-3 sm:px-4">
              Sign Out
            </Button>
          </SignOutButton>
        </>
      )}
    </nav>
  );
};

export default Navigation;