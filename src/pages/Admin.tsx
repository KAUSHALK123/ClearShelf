import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { LogOut, CheckCircle, XCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pendingShops, setPendingShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/auth");
      return;
    }

    // Use secure role checking via RPC
    const { data: isAdmin, error } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (error || !isAdmin) {
      toast({
        title: "Access Denied",
        description: "You don't have admin privileges",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    loadPendingShops();
  };

  const loadPendingShops = async () => {
    const { data, error } = await supabase
      .from("shops")
      .select(`
        *,
        profiles:owner_id (name, email, phone)
      `)
      .eq("verification_status", "pending")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setPendingShops(data);
    }
    setLoading(false);
  };

  const handleVerification = async (shopId: string, status: "verified" | "rejected") => {
    const { error } = await supabase
      .from("shops")
      .update({ verification_status: status })
      .eq("id", shopId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: status === "verified" ? "Shop Approved" : "Shop Rejected",
      description: `The shop has been ${status}`,
    });

    loadPendingShops();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-muted">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary rounded-lg">
              <img src="/clearshelf-logo.png" alt="ClearShelf" className="w-5 h-5 object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Clear Shelf Admin</h1>
              <p className="text-sm text-muted-foreground">Shop Verification</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Pending Shop Verifications</CardTitle>
            <CardDescription>Review and approve shopkeeper registrations</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : pendingShops.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No pending verifications
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shop Name</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>GST Number</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingShops.map((shop) => (
                      <TableRow key={shop.id}>
                        <TableCell className="font-medium">{shop.name}</TableCell>
                        <TableCell>{shop.profiles?.name}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{shop.profiles?.email}</div>
                            {shop.profiles?.phone && (
                              <div className="text-muted-foreground">{shop.profiles.phone}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{shop.address}</TableCell>
                        <TableCell>{shop.gst_number || "N/A"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">Pending</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleVerification(shop.id, "verified")}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleVerification(shop.id, "rejected")}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Admin;