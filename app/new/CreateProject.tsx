"use client";

import { Button } from "@/components/ui/button";
import { SignInButton, SignOutButton, SignUpButton } from "@clerk/nextjs";
import Link from "next/link";
import { useState } from "react";
import { Cover } from "@/components/ui/cover";
import { ShineBorder } from "@/components/magicui/shine-border";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import TooltipCredits from "../components/creditsButton";
import { LoadingSpinner } from "../components/LoadingSpinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { createVideo } from "../actions/create";

const CreateProject = ({
  user,
  credits,
}: {
  user: string | null;
  credits: number;
}) => {
  const router = useRouter();
  const placeholders = [
    "What's the first rule of Fight Club?",
    "Who is Tyler Durden?",
    "Where is Andrew Laeddis Hiding?",
    "Write a Javascript method to reverse a string",
    "How to assemble your own PC?",
    "Explain quantum physics in simple terms",
    "Create a cooking tutorial for pasta",
    "Design a workout routine for beginners",
  ];

  const [prompt, setPrompt] = useState("");
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showCreditDialog, setShowCreditDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="w-screen h-screen flex flex-col">
      {!user && (
        <div className="flex justify-end gap-2 mr-4 sm:mr-7 mt-5 px-4 sm:px-0">
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
        </div>
      )}
      {user && (
        <div className="flex justify-end items-center gap-2 mr-4 sm:mr-7 mt-5 px-4 sm:px-0">
          <TooltipCredits credits={credits} />
          <Button
            asChild
            className="bg-gradient-to-br hover:opacity-80 text-white rounded-full from-[#3352CC] to-[#1C2D70] font-medium cursor-pointer text-sm sm:text-base px-3 sm:px-4"
          >
            <Link href="/dashboard">Dashboard</Link>
          </Button>
          <SignOutButton>
            <Button className="bg-black border border-gray-400 text-white rounded-full hover:bg-gray-900 transition-colors duration-150 cursor-pointer text-sm sm:text-base px-3 sm:px-4">
              Sign Out
            </Button>
          </SignOutButton>
        </div>
      )}

      <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold max-w-7xl mx-auto text-center mt-6 relative z-20 py-6 bg-clip-text text-transparent bg-gradient-to-b from-neutral-800 via-neutral-700 to-neutral-700 dark:from-neutral-800 dark:via-white dark:to-white px-4">
        Generate Realistic Shorts
        <div className="h-6"></div>
        <Cover>warp speed</Cover>
      </h1>

      <div className="flex justify-center items-center flex-1 min-h-0 px-4 pb-8 md:pb-16">
        <div className="relative rounded-3xl w-full max-w-[500px] overflow-hidden">
          <ShineBorder
            className="z-10"
            shineColor={["#3352CC", "#3352CC", "#3352CC", "#3352CC"]}
          />
          <PlaceholdersAndVanishInput
            placeholders={placeholders}
            onChange={(e) => setPrompt(e.target.value)}
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);

              const trimmedPrompt = prompt.trim();
              if (!trimmedPrompt) {
                setError("Please enter a prompt");
                return;
              }

              if (!user) {
                return setTimeout(() => setShowLoginDialog(true), 700);
              }

              if (credits < 1) {
                return setTimeout(() => setShowCreditDialog(true), 700);
              }

              if (isLoading) return; // Prevent multiple submissions

              setIsLoading(true);
              try {
                await createVideo(trimmedPrompt);
                router.push("/dashboard");
              } catch (err) {
                setError("Failed to create video. Please try again.");
                console.error("Video creation error:", err);
              } finally {
                setIsLoading(false);
              }
            }}
          />
          {isLoading && (
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm rounded-3xl flex items-center justify-center z-20">
              <div className="text-white font-medium flex items-center gap-2">
                <LoadingSpinner size="sm" />
                Creating video...
              </div>
            </div>
          )}
          {error && (
            <div className="absolute -bottom-12 left-0 right-0 text-red-500 text-sm text-center">
              {error}
            </div>
          )}
        </div>
        <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-xl">Hello There!</DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400">
                Please sign in to start creating amazing videos with AI.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <SignInButton>
                <Button className="bg-black border border-gray-400 text-white rounded-full hover:bg-gray-900 transition-colors duration-150 cursor-pointer">
                  Sign In
                </Button>
              </SignInButton>
              <SignUpButton>
                <Button className="bg-gradient-to-br hover:opacity-80 text-white rounded-full from-[#3352CC] to-[#1C2D70] font-medium cursor-pointer">
                  Sign Up
                </Button>
              </SignUpButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={showCreditDialog} onOpenChange={setShowCreditDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-xl">
                <div className="text-red-500 flex items-center gap-2">
                  <span>⚡</span>
                  Out of Credits
                </div>
              </DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400">
                You need credits to create videos. Check out our pricing plans
                to continue creating amazing content.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button
                className="bg-gradient-to-br hover:opacity-80 text-white rounded-full from-[#3352CC] to-[#1C2D70] font-medium cursor-pointer"
                onClick={() => {
                  router.push("/pricing");
                  setShowCreditDialog(false);
                }}
              >
                View Pricing
              </Button>
              <Button
                variant="outline"
                className="rounded-full cursor-pointer"
                onClick={() => setShowCreditDialog(false)}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default CreateProject;
