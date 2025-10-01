import { auth } from "@clerk/nextjs/server";
import { userCredits } from "@/app/lib/userCredits";
import Navigation from "./Navigation";

const NavigationWrapper = async (): Promise<React.ReactElement> => {
  const { userId } = await auth();
  
  let credits: number | undefined = undefined;
  if (userId) {
    credits = await userCredits(userId);
  }

  return <Navigation credits={credits} />;
};

export default NavigationWrapper;