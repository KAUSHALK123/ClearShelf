import { useEffect, useState } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface Shop {
  id: string;
  name: string;
  address: string;
  gst_number: string | null;
  verification_status: string;
  created_at: string;
  profiles: {
    name: string;
    email: string;
    phone: string | null;
  };
}

const AdminShops = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");

  useEffect(() => {
    loadShops();

    const channel = supabase
      .channel('admin-shops-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shops' }, loadShops)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadShops = async () => {
    // Fetch shops
    const { data: shopsData, error: shopsError } = await supabase
      .from('shops')
      .select('*')
      .order('created_at', { ascending: false });

    if (shopsError) {
      console.error('Error loading shops:', shopsError);
      toast({
        title: "Error loading shops",
        description: shopsError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (!shopsData || shopsData.length === 0) {
      setShops([]);
      setLoading(false);
      return;
    }

    // Fetch all owner profiles separately (admins have access to all profiles)
    const ownerIds = [...new Set(shopsData.map(shop => shop.owner_id))];
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, email, phone')
      .in('id', ownerIds);

    if (profilesError) {
      console.error('Error loading profiles:', profilesError);
    }

    // Merge shop and profile data
    const shopsWithOwners = shopsData.map(shop => ({
      ...shop,
      profiles: profilesData?.find(p => p.id === shop.owner_id) || {
        name: 'Unknown',
        email: null,
        phone: null
      }
    }));

    setShops(shopsWithOwners as any);
    setLoading(false);
  };

  const handleVerification = async (shopId: string, status: "verified" | "rejected") => {
    const { error } = await supabase
      .from('shops')
      .update({ 
        verification_status: status,
        verified_at: new Date().toISOString(),
        verified_by: (await supabase.auth.getUser()).data.user?.id
      })
      .eq('id', shopId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // Log admin activity
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('admin_activity_logs').insert({
        admin_id: user.id,
        action_type: status === 'verified' ? 'shop_approved' : 'shop_rejected',
        target_type: 'shop',
        target_id: shopId,
        details: { status }
      });
    }

    toast({
      title: status === "verified" ? "Shop Approved" : "Shop Rejected",
      description: `The shop has been ${status}`,
    });

    loadShops();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-500">Verified</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredShops = shops.filter(shop => {
    if (activeTab === 'all') return true;
    return shop.verification_status === activeTab;
  });

  return (
    <div>
      <AdminHeader title="Shop Management" />
      
      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All Shops</TabsTrigger>
            <TabsTrigger value="pending">
              Pending ({shops.filter(s => s.verification_status === 'pending').length})
            </TabsTrigger>
            <TabsTrigger value="verified">Verified</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Loading shops...</p>
              </div>
            ) : filteredShops.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No shops found</p>
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
                    {filteredShops.map((shop) => (
                      <TableRow key={shop.id}>
                        <TableCell className="font-medium">{shop.name}</TableCell>
                        <TableCell>{shop.profiles?.name}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{shop.profiles?.email || "N/A"}</div>
                            {shop.profiles?.phone && (
                              <div className="text-muted-foreground">{shop.profiles.phone}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{shop.address}</TableCell>
                        <TableCell>{shop.gst_number || "N/A"}</TableCell>
                        <TableCell>{getStatusBadge(shop.verification_status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/admin/shops/${shop.id}`)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                            {shop.verification_status === 'pending' && (
                              <>
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
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminShops;
