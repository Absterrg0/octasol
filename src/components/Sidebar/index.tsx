"use client";
import { IconChartHistogram } from "@tabler/icons-react";
import { Blocks, CopyPlus, HomeIcon, User } from "lucide-react";
import Link from "next/link";
import React from "react";
import { useSelector } from "react-redux";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePathname } from "next/navigation";

type Props = {};

const Sidebar = (props: Props) => {
  const user = useSelector((state: any) => state.user);
  const pathname = usePathname();

  const isActive = (linkPath: string) => pathname.includes(linkPath);

  return (
    <>
      <div className="w-full flex justify-between">
        <div className="w-full pt-24 pb-4 min-h-screen z-50 overflow-hidden flex flex-col items-start gap-8 px-5 transition-all duration-500 ease-in-out group hover:w-[200px] relative">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Link
                  href="/dashboard"
                  className="flex items-center gap-4 hover:text-[#45bd95]"
                >
                  <HomeIcon
                    size={32}
                    color={isActive("/dashboard") ? "cyan" : "currentColor"}
                  />

                  <span
                    className={`hidden group-hover:inline-block transition-all duration-300 ease-in-out  ${
                      isActive("/dashboard") && "text-cyan-500"
                    }`}
                  >
                    Dashboard
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent className="bg-black">
                <p>Dashboard</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger>
                <Link
                  href={`/p/${user?.login}`}
                  className="flex items-center gap-4 hover:text-[#45bd95]"
                >
                  <User
                    size={32}
                    color={isActive("/p/") ? "cyan" : "currentColor"}
                  />
                  <span
                    className={`hidden group-hover:inline-block transition-all duration-300 ease-in-out  ${
                      isActive("/p/") && "text-cyan-500"
                    }`}
                  >
                    Profile
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent className="bg-black">
                <p>Profile</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger>
                <Link
                  href="/repoinitialize"
                  className="flex items-center gap-4 hover:text-[#45bd95]"
                >
                  <CopyPlus
                    size={32}
                    color={
                      isActive("/repoinitialize") ? "cyan" : "currentColor"
                    }
                  />
                  <span
                    className={`hidden group-hover:inline-block transition-all duration-300 ease-in-out  ${
                      isActive("/repoinitialize") && "text-cyan-500"
                    }`}
                  >
                    Repository
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent className="bg-black">
                <p>Repository</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger>
                <Link
                  href="/connect"
                  className="flex items-center gap-4 hover:text-[#45bd95]"
                >
                  <Blocks
                    size={32}
                    color={isActive("/connect") ? "cyan" : "currentColor"}
                  />
                  <span
                    className={`hidden group-hover:inline-block transition-all duration-300 ease-in-out  ${
                      isActive("/connect") && "text-cyan-500"
                    }`}
                  >
                    Connect
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent className="bg-black">
                <p>Connect</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger>
                <Link
                  href="/leaderboard"
                  className="flex items-center gap-4 hover:text-[#45bd95]"
                >
                  <IconChartHistogram
                    size={32}
                    color={isActive("/leaderboard") ? "cyan" : "currentColor"}
                  />
                  <span
                    className={`hidden group-hover:inline-block transition-all duration-300 ease-in-out  ${
                      isActive("/leaderboard") && "text-cyan-500"
                    }`}
                  >
                    Leaderboard
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent className="bg-black">
                <p>Leaderboard</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="rotate-180 h-screen w-px">
          <div className="w-full h-full bg-gradient-to-b from-transparent via-[#39628b] to-transparent"></div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
