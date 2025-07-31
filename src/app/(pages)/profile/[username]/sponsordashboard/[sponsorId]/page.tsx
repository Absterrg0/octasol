"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Wallet,
  Trophy,
  Users,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSelector } from "react-redux";
import { GET, POST } from "@/config/axios/requests";
import Image from "next/image";

type Props = {
  params: {
    sponsorid: string;
  };
};

const SponsorDashboard = (props: Props) => {
  const user = useSelector((state: any) => state.user);
  const [sponsorData, setSponsorData] = useState<any>(null);
  const [selectedSponsor, setSelectedSponsor] = useState<any>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "",
    link: "",
    twitter: "",
    telegram: "",
    discord: "",
    image: "",
  });

  const fetchSponsorData = async () => {
    try {
      const response = await GET("/sponsor/dashboard", {
        Authorization: `Bearer ${user.accessToken}`,
      });
      console.log(response);
      if (response) {
        setSponsorData(response.data);
      }
    } catch (error) {}
  };

  useEffect(() => {
    if (user.accessToken) fetchSponsorData();
  }, [user]);

  useEffect(() => {
    if (sponsorData) {
      const sponsor = sponsorData.find(
        (item: any) => item.sponsor.id === parseInt(props.params.sponsorid)
      );
      if (sponsor) {
        setSelectedSponsor(sponsor);
      }
    }
  }, [sponsorData, props.params.sponsorid]);

  useEffect(() => {
    if (selectedSponsor) {
      setFormData({
        name: selectedSponsor.sponsor.name || "",
        description: selectedSponsor.sponsor.description || "",
        type: selectedSponsor.sponsor.type || "",
        link: selectedSponsor.sponsor.link || "",
        twitter: selectedSponsor.sponsor.twitter || "",
        telegram: selectedSponsor.sponsor.telegram || "",
        discord: selectedSponsor.sponsor.discord || "",
        image: selectedSponsor.sponsor.image || "",
      });
    }
  }, [selectedSponsor]);

  const handleUpdateSponsor = async () => {
    try {
      console.log(formData);
      const response = await POST(
        "/sponsor/update",
        {
          id: selectedSponsor.sponsor.id,
          name: selectedSponsor.sponsor.name,
          description: formData.description,
          link: formData.link,
          twitter: formData.twitter,
          telegram: formData.telegram,
          discord: formData.discord,
        },
        {
          Authorization: `Bearer ${user.accessToken}`,
        }
      );
      console.log(response);
      setIsUpdateDialogOpen(false);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="w-full h-full p-5 space-y-8">
      <div className="flex justify-between md:justify-end items-end gap-2">
        <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Pencil className="mr-2 h-4 w-4" /> Update Sponsor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">
                Update Sponsor Profile
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="flex items-center justify-between gap-4 w-full">
                <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-primary/20">
                  {formData.image ? (
                    <Image
                      src={formData.image}
                      alt="Sponsor Logo"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-8 w-8 text-primary/50" />
                    </div>
                  )}
                </div>
                <div className="w-9/12">
                  <div className="space-y-2">
                    <Label htmlFor="name">Organization Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      placeholder="Enter organization name"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Enter organization bio"
                  className="min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Social Links</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="link"
                      className="text-sm text-muted-foreground"
                    >
                      Website
                    </Label>
                    <Input
                      id="link"
                      value={formData.link}
                      onChange={(e) =>
                        setFormData({ ...formData, link: e.target.value })
                      }
                      placeholder="https://"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="twitter"
                      className="text-sm text-muted-foreground"
                    >
                      Twitter
                    </Label>
                    <Input
                      id="twitter"
                      value={formData.twitter}
                      onChange={(e) =>
                        setFormData({ ...formData, twitter: e.target.value })
                      }
                      placeholder="@username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="telegram"
                      className="text-sm text-muted-foreground"
                    >
                      Telegram
                    </Label>
                    <Input
                      id="telegram"
                      value={formData.telegram}
                      onChange={(e) =>
                        setFormData({ ...formData, telegram: e.target.value })
                      }
                      placeholder="@username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="discord"
                      className="text-sm text-muted-foreground"
                    >
                      Discord
                    </Label>
                    <Input
                      id="discord"
                      value={formData.discord}
                      onChange={(e) =>
                        setFormData({ ...formData, discord: e.target.value })
                      }
                      placeholder="Discord username"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsUpdateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateSponsor}
                className="bg-primary hover:bg-primary/90"
              >
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Create Bounty
        </Button>
      </div>

      {selectedSponsor && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Wallet className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Rewarded
                  </p>
                  <h3 className="text-2xl font-bold">
                    {selectedSponsor.metrics.totalRewarded} SOL
                  </h3>
                </div>
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Trophy className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Listings
                  </p>
                  <h3 className="text-2xl font-bold">
                    {selectedSponsor.metrics.totalListings}
                  </h3>
                </div>
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Submissions
                  </p>
                  <h3 className="text-2xl font-bold">
                    {selectedSponsor.metrics.totalSubmissions}
                  </h3>
                </div>
              </div>
            </Card>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bounty Name</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Submissions</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedSponsor.bounties?.map((bounty: any) => (
                  <TableRow key={bounty.id}>
                    <TableCell className="font-medium">
                      {bounty.bountyname}
                    </TableCell>
                    <TableCell>{bounty.price} $</TableCell>
                    <TableCell>
                      <Badge>
                        {bounty.status === 2 ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      {new Date(bounty.time).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{bounty.submissions?.length || 0}</TableCell>
                    <TableCell>
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
};

export default SponsorDashboard;
