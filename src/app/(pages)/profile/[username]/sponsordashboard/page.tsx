"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Eye } from "lucide-react";
import { useSelector } from "react-redux";
import { GET } from "@/config/axios/requests";
import Image from "next/image";
import { useRouter } from "next/navigation";

type Props = {};

const SponsorDashboard = (props: Props) => {
  const router = useRouter();
const user = useSelector((state: any) => state.user);
  const [sponsorData, setSponsorData] = useState<any>(null);


  const handleSponsorRedirect = (item:any)=>{
    if(item.sponsor.type === "Github Issue"){
      router.push(
        `/profile/${user.name}/sponsordashboard/${item.sponsor.id}/escrow`
      );
    }
    else{
      router.push(
        `/profile/${user.name}/sponsordashboard/${item.sponsor.id}`
      );
    }
  }

  const fetchSponsorData = async () => {
    try {

      const response = await GET("/sponsor/dashboard", {
        Authorization: `Bearer ${user.accessToken}`,
      });

      if (response) {
        setSponsorData(response.data);
      }
    } catch (error) {}
  };

  useEffect(() => {
    if (user.accessToken) fetchSponsorData();
  }, [user]);


  // const getStatusColor = (status: string) => {
  //   switch (status.toLowerCase()) {
  //     case "active":
  //       return "bg-green-500/10 text-green-500";
  //     case "draft":
  //       return "bg-yellow-500/10 text-yellow-500";
  //     case "completed":
  //       return "bg-blue-500/10 text-blue-500";
  //     default:
  //       return "bg-gray-500/10 text-gray-500";
  //   }
  // };
  return (
    <div className="w-full h-full p-5 space-y-8">
      <div className="flex justify-end items-end">
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create Sponsor
            </Button>
          </DialogTrigger>
        </Dialog>
      </div>

      {/* Responsive Table Container */}
      <div className="w-full overflow-x-auto">
        <Card className="w-full">
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Sponsor</TableHead>
                <TableHead className=" hidden lg:table-cell">Type</TableHead>
                <TableHead>Link</TableHead>
                <TableHead className="">Twitter</TableHead>
                <TableHead className="">Telegram</TableHead>
                <TableHead className="">Discord</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sponsorData?.map((item: any) => (
                <TableRow
                  key={item.sponsor.id}
                  className="hover:cursor-pointer"
                  onClick={() => {handleSponsorRedirect(item)}}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Image
                        src={item.sponsor.image || ""}
                        alt={item.sponsor.name || "Sponsor"}
                        width={20}
                        height={20}
                        className="rounded-full"
                      />
                      <p className="font-medium">{item.sponsor.name}</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {item.sponsor.type}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center max-w-[120px] truncate">
                      <a
                        href={item.sponsor.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate"
                      >
                        {item.sponsor.link}
                      </a>
                    </div>
                  </TableCell>
                  <TableCell className=" ">
                    {item.sponsor.twitter || "-"}
                  </TableCell>
                  <TableCell className="">
                    {item.sponsor.telegram || "-"}
                  </TableCell>
                  <TableCell className="">
                    {item.sponsor.discord || "-"}
                  </TableCell>
                  {/* <TableCell>
                    <Badge>{item.sponsor.status}</Badge>
                  </TableCell> */}
                  {/* <TableCell className="">
                    {item.sponsor?.createdAt?.split("T")[0]}
                  </TableCell> */}
                  {/* <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="h-4 w-4 mr-2" /> View Details
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell> */}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
};

export default SponsorDashboard;
