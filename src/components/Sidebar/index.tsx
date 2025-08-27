"use client";
import {
  BadgeDollarSign,
  Blocks,
  CopyPlus,
  HomeIcon,
  User,
  ListChecks,
  Briefcase,
  Shield,
} from "lucide-react";
import { IconChartHistogram } from "@tabler/icons-react";
import Link from "next/link";
import React from "react";
import { useSelector } from "react-redux";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isAdmin } from "@/lib/constants";
import { useEffect, useState } from "react";

type Props = {
  verified: boolean;
};

const Sidebar = ({ verified }: Props) => {
  const user = useSelector((state: any) => state.user);
  const pathname = usePathname();
  const [isAdminUser, setIsAdminUser] = useState(false);

  // Check admin status
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user?.login) {
        const adminStatus = await isAdmin(user.login);
        setIsAdminUser(adminStatus);
      }
    };
    
    checkAdminStatus();
  }, [user]);

  // Updated isActive function
  const isActive = (linkPath: string, exact = false) => {
    if (exact) {
      return pathname === linkPath;
    }
    return pathname.startsWith(linkPath);
  };

  const userProfilePath = `/profile/${user?.login}`;
  const sponsorDashboardPath = `/profile/${user?.login}/sponsordashboard`;
  const userSubmissionsPath = `/profile/${user?.login}/submissions`;

  return (
    <>
      <div className="w-full flex justify-between">
        <div
          className={cn(
            "w-full pt-24 pb-4 min-h-screen overflow-hidden flex flex-col items-start gap-8 px-5 transition-all duration-500 ease-in-out group hover:w-[250px] relative",
            verified ? "z-50" : "z-0 hidden"
          )}
        >
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
                href={userProfilePath}
                className="flex items-center gap-4 hover:text-[#45bd95]"
              >
                <User
                  size={32}
                  color={isActive(userProfilePath, true) ? "cyan" : "currentColor"}
                />
                <span
                  className={`hidden group-hover:inline-block transition-all duration-300 ease-in-out  ${
                    isActive(userProfilePath, true) && "text-cyan-500"
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
                href={userSubmissionsPath}
                className="flex items-center gap-4 hover:text-[#45bd95]"
              >
                <ListChecks
                  size={32}
                  color={isActive(userSubmissionsPath) ? "cyan" : "currentColor"}
                />
                <span
                  className={`hidden group-hover:inline-block transition-all duration-300 ease-in-out  ${
                    isActive(userSubmissionsPath) && "text-cyan-500"
                  }`}
                >
                  Submissions
                </span>
              </Link>
            </TooltipTrigger>
            <TooltipContent className="bg-black">
              <p>Submissions</p>
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
                  color={isActive("/repoinitialize") ? "cyan" : "currentColor"}
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

          <Tooltip>
            <TooltipTrigger>
              <Link
                href="/bounty"
                className="flex items-center gap-4 hover:text-[#45bd95]"
              >
                <BadgeDollarSign
                  size={32}
                  color={isActive("/bounty") ? "cyan" : "currentColor"}
                />
                <span
                  className={`hidden group-hover:inline-block transition-all duration-300 ease-in-out  ${
                    isActive("/bounty") && "text-cyan-500"
                  }`}
                >
                  Bounty
                </span>
              </Link>
            </TooltipTrigger>
            <TooltipContent className="bg-black">
              <p>Bounty</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <Link
                href={sponsorDashboardPath}
                className="flex items-center gap-4 hover:text-[#45bd95]"
              >
                <Briefcase
                  size={32}
                  color={isActive(sponsorDashboardPath) ? "cyan" : "currentColor"}
                />
                <span
                  className={`hidden group-hover:inline-block transition-all duration-300 ease-in-out  ${
                    isActive(sponsorDashboardPath) && "text-cyan-500"
                  }`}
                >
                  Sponsor Dashboard
                </span>
              </Link>
            </TooltipTrigger>
            <TooltipContent className="bg-black">
              <p>Sponsor Dashboard</p>
            </TooltipContent>
          </Tooltip>

          {/* Admin-only link for cancellation requests */}
          {isAdminUser && (
            <Tooltip>
              <TooltipTrigger>
                <Link
                  href="/admin/bounties"
                  className="flex items-center gap-4 hover:text-[#45bd95]"
                >
                  <Shield
                    size={32}
                    color={isActive("/admin/bounties") ? "cyan" : "currentColor"}
                  />
                  <span
                    className={`hidden group-hover:inline-block transition-all duration-300 ease-in-out  ${
                      isActive("/admin/bounties") && "text-cyan-500"
                    }`}
                  >
                    Admin Panel
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent className="bg-black">
                <p>Admin Panel</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="rotate-180 h-screen w-px">
          <div className="w-full h-full bg-gradient-to-b from-transparent via-[#39628b] to-transparent"></div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;