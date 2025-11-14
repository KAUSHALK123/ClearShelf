import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminHeader from "@/components/admin/AdminHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import { z } from "zod";

interface Complaint {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  customer_id: string;
  shop_id: string | null;
  product_id: string | null;
  resolution_note: string | null;
  created_at: string;
  profiles: { name: string; phone: string };
  shops: { name: string } | null;
}

const AdminComplaints = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolutionNote, setResolutionNote] = useState("");
  const [selectedComplaint, setSelectedComplaint] = useState<string | null>(null);
  const { toast } = useToast();

  // Validation schema for resolution notes
  const resolutionSchema = z.object({
    note: z.string().trim().min(10, "Resolution note must be at least 10 characters").max(2000, "Resolution note too long")
  });

  useEffect(() => {
    loadComplaints();
    
    const channel = supabase
      .channel("complaints-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, () => {
        loadComplaints();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadComplaints = async () => {
    const { data, error } = await supabase
      .from("complaints")
      .select("*, profiles!customer_id(name, phone), shops(name)")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load complaints",
        variant: "destructive",
      });
    } else {
      // Transform the data to flatten the profiles array
      const transformedComplaints = data?.map((complaint: any) => ({
        ...complaint,
        profiles: Array.isArray(complaint.profiles) ? complaint.profiles[0] : complaint.profiles,
        shops: Array.isArray(complaint.shops) ? complaint.shops[0] : complaint.shops
      }));
      setComplaints(transformedComplaints as Complaint[]);
    }
    setLoading(false);
  };

  const updateComplaintStatus = async (complaintId: string, newStatus: "under_review" | "resolved", note?: string) => {
    try {
      // Validate resolution note if provided
      if (note) {
        resolutionSchema.parse({ note });
      }

      const updateData: any = { status: newStatus };
      if (note) updateData.resolution_note = note;
      if (newStatus === "resolved") updateData.resolved_at = new Date().toISOString();

      const { error } = await supabase
        .from("complaints")
        .update(updateData)
        .eq("id", complaintId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Complaint ${newStatus === "resolved" ? "resolved" : "updated"} successfully`,
      });
      setResolutionNote("");
      setSelectedComplaint(null);
      loadComplaints();
    } catch (error: any) {
      const errorMessage = error instanceof z.ZodError 
        ? error.errors[0].message 
        : error.message;
      
      toast({
        title: "Validation Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive"; icon: any }> = {
      pending: { variant: "secondary", icon: Clock },
      under_review: { variant: "default", icon: Clock },
      resolved: { variant: "default", icon: CheckCircle },
    };
    const { variant, icon: Icon } = variants[status] || variants.pending;
    return (
      <Badge variant={variant} className="flex items-center gap-1 w-fit">
        <Icon className="w-3 h-3" />
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const filterComplaints = (status: string) => {
    if (status === "all") return complaints;
    return complaints.filter((c) => c.status === status);
  };

  return (
    <div className="p-6 space-y-6">
      <AdminHeader title="Complaint Management" />

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="under_review">Under Review</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>

        {["all", "pending", "under_review", "resolved"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardHeader>
                <CardTitle>
                  {tab === "all" ? "All Complaints" : `${tab.replace("_", " ").charAt(0).toUpperCase() + tab.slice(1).replace("_", " ")} Complaints`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Loading complaints...</div>
                ) : filterComplaints(tab).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No {tab === "all" ? "" : tab.replace("_", " ")} complaints found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Shop</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filterComplaints(tab).map((complaint) => (
                        <TableRow key={complaint.id}>
                          <TableCell className="font-medium">{complaint.title}</TableCell>
                          <TableCell>
                            <div>
                              <div>{complaint.profiles.name}</div>
                              <div className="text-sm text-muted-foreground">{complaint.profiles.phone}</div>
                            </div>
                          </TableCell>
                          <TableCell>{complaint.shops?.name || "N/A"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{complaint.category}</Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(complaint.status)}</TableCell>
                          <TableCell>
                            {new Date(complaint.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    View
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>{complaint.title}</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div>
                                      <strong>Description:</strong>
                                      <p className="mt-1">{complaint.description}</p>
                                    </div>
                                    {complaint.resolution_note && (
                                      <div>
                                        <strong>Resolution Note:</strong>
                                        <p className="mt-1">{complaint.resolution_note}</p>
                                      </div>
                                    )}
                                  </div>
                                </DialogContent>
                              </Dialog>
                              
                              {complaint.status !== "resolved" && (
                                <>
                                  {complaint.status === "pending" && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => updateComplaintStatus(complaint.id, "under_review")}
                                    >
                                      Under Review
                                    </Button>
                                  )}
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => setSelectedComplaint(complaint.id)}
                                      >
                                        <CheckCircle className="w-4 h-4 mr-1" />
                                        Resolve
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Resolve Complaint</DialogTitle>
                                      </DialogHeader>
                                      <div className="space-y-4">
                                        <Textarea
                                          placeholder="Enter resolution notes..."
                                          value={resolutionNote}
                                          onChange={(e) => setResolutionNote(e.target.value)}
                                        />
                                        <Button
                                          onClick={() => updateComplaintStatus(complaint.id, "resolved", resolutionNote)}
                                        >
                                          Mark as Resolved
                                        </Button>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default AdminComplaints;
