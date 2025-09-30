import { auth } from "@clerk/nextjs/server";
import { userCredits } from "@/app/lib/userCredits";
import Navigation from "./Navigation";

const NavigationWrapper = async () => {
  const { userId } = await auth();
  
  let credits = 0;
  if (userId) {
    try {
      credits = await userCredits(userId);
    } catch (error) {
      console.error("Error fetching user credits:", error);
    }
  }

  return <Navigation credits={userId ? credits : undefined} />;
};

export default NavigationWrapper;