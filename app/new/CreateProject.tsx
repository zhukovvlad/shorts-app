"use client";

import { Button } from "@/components/ui/button";
import { SignInButton, SignOutButton, SignUpButton } from "@clerk/nextjs";
import Link from "next/link";
import { useState } from "react";
import { Cover } from "@/components/ui/cover";
import { ShineBorder } from "@/components/magicui/shine-border";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";

const CreateProject = ({ user }: { user: string | null }) => {
  const placeholders = [
    "What's the first rule of Fight Club?",
    "Who is Tyler Durden?",
    "Where is Andrew Laeddis Hiding?",
    "Write a Javascript method to reverse a string",
    "How to assemble your own PC?",
  ];

  const [prompt, setPrompt] = useState("");

  return (
    <div className="w-screen h-screen flex flex-col">
      {!user && (
        <div className="flex justify-end gap-1 mr-7 mt-5">
          <SignInButton>
            <Button className="bg-black border border-gray-400 text-white rounded-full mx-2 hover:bg-gray-900 transition-colors duration-150 cursor-pointer">
              Sign In
            </Button>
          </SignInButton>
          <SignUpButton>
            <Button className="bg-gradient-to-br hover:opacity-80 text-white rounded-full from-[#3352CC] to-[#1C2D70] font-medium cursor-pointer">
              Sign Up
            </Button>
          </SignUpButton>
        </div>
      )}
      {user && (
        <div className="flex justify-end mr-7 mt-5">
          <Button
            asChild
            className="bg-gradient-to-br hover:opacity-80 text-white rounded-full from-[#3352CC] to-[#1C2D70] font-medium mx-2 cursor-pointer"
          >
            <Link href="/dashboard">Dashboard</Link>
          </Button>
          <SignOutButton>
            <Button className="bg-black border border-gray-400 text-white rounded-full mx-2 hover:bg-gray-900 transition-colors duration-150 cursor-pointer">
              Sign Out
            </Button>
          </SignOutButton>
        </div>
      )}

      <h1 className="text-4xl md:text-4xl lg:text-6xl font-semibold max-w-7xl mx-auto text-center mt-6 relative z-20 py-6 bg-clip-text text-transparent bg-gradient-to-b from-neutral-800 via-neutral-700 to-neutral-700 dark:from-neutral-800 dark:via-white dark:to-white">
        Generate Realistic Shorts
        <div className="h-6"></div>
        <Cover>warp speed</Cover>
      </h1>

      <div className="flex justify-center mt-auto mb-[400px]">
        <div className="relative rounded-3xl w-full max-w-[500px] overflow-hidden">
          <ShineBorder
            className="z-10"
            shineColor={["#3352CC", "#3352CC", "#3352CC", "#3352CC"]}
          />
          <PlaceholdersAndVanishInput
            placeholders={placeholders}
            onChange={(e) => setPrompt(e.target.value)}
            onSubmit={() => {}}
          />
        </div>
      </div>
    </div>
  );
};

export default CreateProject;
