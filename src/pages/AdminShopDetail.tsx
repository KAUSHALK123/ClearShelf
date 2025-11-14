import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminHeader from "@/components/admin/AdminHeader";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, XCircle, MapPin, Phone, Mail, Calendar } from "lucide-react";

interface ShopDetail {
  id: string;
  name: string;
  address: string;
  gst_number: string | null;
  verification_status: string;
  created_at: string;
  latitude: number;
  longitude: number;
  rejection_reason: string | null;
  profiles: {
    name: string;
    email: string;
    phone: string | null;
  };
}

const AdminShopDetail = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [shop, setShop] = useState<ShopDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    loadShopDetail();
  }, [shopId]);

  const loadShopDetail = async () => {
    const { data, error } = await supabase
      .from('shops')
      .select(`
        *,
        profiles:owner_id (name, email, phone)
      `)
      .eq('id', shopId)
      .single();

    if (!error && data) {
      setShop(data as any);
    }
    setLoading(false);
  };

  const handleVerification = async (status: "verified" | "rejected") => {
    if (status === "rejected" && !rejectionReason.trim()) {
      toast({
        title: "Rejection reason required",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from('shops')
      .update({ 
        verification_status: status,
        verified_at: status === 'verified' ? new Date().toISOString() : null,
        verified_by: (await supabase.auth.getUser()).data.user?.id,
        rejection_reason: status === 'rejected' ? rejectionReason : null
      })
      .eq('id', shopId!);

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
        target_id: shopId!,
        details: { status, rejection_reason: rejectionReason }
      });
    }

    toast({
      title: status === "verified" ? "Shop Approved" : "Shop Rejected",
      description: `The shop has been ${status}`,
    });

    navigate('/admin/shops');
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

  if (loading) {
    return (
      <div>
        <AdminHeader title="Shop Details" />
        <div className="p-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading shop details...</p>
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div>
        <AdminHeader title="Shop Details" />
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Shop not found</p>
          <Button onClick={() => navigate('/admin/shops')} className="mt-4">
            Back to Shops
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AdminHeader title="Shop Details" />
      
      <div className="p-6 max-w-4xl">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/admin/shops')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Shops
        </Button>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">{shop.name}</CardTitle>
                {getStatusBadge(shop.verification_status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-2">
                  <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-medium">{shop.address}</p>
                    <p className="text-sm text-muted-foreground">
                      Lat: {shop.latitude}, Long: {shop.longitude}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Registered</p>
                    <p className="font-medium">
                      {new Date(shop.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">GST Number</p>
                <p className="font-medium">{shop.gst_number || "Not provided"}</p>
              </div>

              {shop.rejection_reason && (
                <div className="bg-destructive/10 p-4 rounded-lg">
                  <p className="text-sm font-medium text-destructive mb-1">Rejection Reason</p>
                  <p className="text-sm">{shop.rejection_reason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Owner Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{shop.profiles?.name}</p>
              </div>

              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{shop.profiles?.email || "Not available"}</p>
                </div>
              </div>

              {shop.profiles?.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{shop.profiles.phone}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {shop.verification_status === 'pending' && (
            <Card>
              <CardHeader>
                <CardTitle>Verification Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Rejection Reason (Optional for approval, required for rejection)
                  </label>
                  <Textarea
                    placeholder="Provide a reason if rejecting this shop..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => handleVerification("verified")}
                    className="flex-1"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve Shop
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleVerification("rejected")}
                    className="flex-1"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject Shop
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminShopDetail;
