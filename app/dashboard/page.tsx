import { auth } from "@clerk/nextjs/server";
import React from "react";
import { prisma } from "../lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";
import { VideoCard } from "../components/videoCard";
import { redirect } from "next/navigation";

const Dashboard = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  let videos: any[] = [];
  try {
    videos = await prisma.video.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  } catch (error) {
    console.error("Database error:", error);
    // Handle database error - could show error UI or fallback
    videos = [];
  }

    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold">Your Videos</h1>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button 
              asChild 
              className="w-full sm:w-auto bg-gradient-to-br hover:opacity-80 text-white rounded-full from-[#3352CC] to-[#1C2D70] font-medium cursor-pointer text-sm sm:text-base px-3 sm:px-4 flex-1 sm:flex-initial"
            >
              <Link href="/new">
                <Plus className="h-4 w-4 mr-2" />
                Create New
              </Link>
            </Button>

            <SignOutButton>
              <Button className="bg-black border border-gray-400 text-white rounded-full hover:bg-gray-900 transition-colors duration-150 cursor-pointer text-sm sm:text-base px-3 sm:px-4">
                Sign Out
              </Button>
            </SignOutButton>
          </div>
        </div>

        {videos.length === 0 ? (
          <div className="text-center py-12 sm:py-16 bg-gray-800 rounded-lg mx-auto max-w-md">
            <div className="mb-4">
              <Plus className="h-12 w-12 mx-auto text-gray-400" />
            </div>
            <p className="text-lg sm:text-xl mb-4">
              You have not created any videos yet
            </p>
            <p className="text-sm text-gray-400 mb-6">
              Start creating engaging short videos with AI
            </p>
            <Button
              asChild
              className="bg-gradient-to-br hover:opacity-80 text-white rounded-full from-[#3352CC] to-[#1C2D70] font-medium cursor-pointer text-sm sm:text-base px-4 sm:px-6"
            >
              <Link href="/new">Create your first video</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {videos.map((video) => (
              <VideoCard key={video.videoId} video={video} />
            ))}
          </div>
        )}
      </div>
    );
};

export default Dashboard;