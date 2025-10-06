import { auth } from "@/auth";
import { userCredits } from "@/app/lib/userCredits";
import Navigation from "./Navigation";

const NavigationWrapper = async (): Promise<React.ReactElement> => {
  const session = await auth();
  
  let credits: number | undefined = undefined;
  if (session?.user?.id) {
    credits = await userCredits(session.user.id);
  }

  return <Navigation credits={credits} />;
};

export default NavigationWrapper;