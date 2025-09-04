import { Tooltip, Button } from "@heroui/react";
import { Zap } from "lucide-react";

const TooltipCredits = ({ credits }: { credits: number }) => {
  return (
    <Tooltip
      size="sm"
      showArrow
      classNames={{
        base: [
          // arrow color
          "before:bg-neutral-400 dark:before:bg-white",
        ],
        content: [
          "py-2 px-4 shadow-xl",
          "text-black bg-linear-to-br from-white to-neutral-400 rounded-2xl",
        ],
      }}
      content={
        <div className="flex flex-col items-center gap-1 p-2">
          <span>You currently have {credits} credits left</span>
          <Button
            variant="flat"
            onPress={() => (window.location.href = "/pricing")}
            className="bg-gradient-to-br hover:opacity-80 text-white rounded-full from-[#3352CC] to-[#1C2D70] font-medium mx-2 cursor-pointer text-xs py-1 px-2 w-[90px]"
          >
            Pricing
          </Button>
        </div>
      }
      placement="bottom"
    >
      <Button variant="flat" size="sm">
        <Zap size={16} className="text-yellow-500" fill="currentColor" />
        {credits}
      </Button>
    </Tooltip>
  );
};

export default TooltipCredits;
