'use server'

import { auth } from "@/auth";
import { prisma } from "./db";
import { revalidatePath } from "next/cache";

export async function deleteVideo(videoId: string) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return null
        }
        
        const userId = session.user.id;
        await prisma.video.delete({
            where: { videoId: videoId, userId: userId }
        })

        revalidatePath('/dashboard')

        return { success: true }
    } catch {
        return { success: false, error: "Failed to delete video" }
    }
}