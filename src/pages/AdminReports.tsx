import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminHeader from "@/components/admin/AdminHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, TrendingUp, Users, Store } from "lucide-react";
import AdminStatsCard from "@/components/admin/AdminStatsCard";

const AdminReports = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalShops: 0,
    totalTransactions: 0,
    foodSavedKg: 0,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const { count: usersCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    const { count: shopsCount } = await supabase
      .from("shops")
      .select("*", { count: "exact", head: true });

    const { count: transactionsCount } = await supabase
      .from("transactions")
      .select("*", { count: "exact", head: true });

    setStats({
      totalUsers: usersCount || 0,
      totalShops: shopsCount || 0,
      totalTransactions: transactionsCount || 0,
      foodSavedKg: (transactionsCount || 0) * 0.5,
    });
    setLoading(false);
  };

  const downloadReport = (reportType: string) => {
    toast({
      title: "Report Generation",
      description: `Generating ${reportType} report...`,
    });
    // Report generation logic would go here
  };

  return (
    <div className="p-6 space-y-6">
      <AdminHeader title="Reports & Analytics" />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <AdminStatsCard
          title="Total Users"
          value={stats.totalUsers}
          icon={Users}
        />
        <AdminStatsCard
          title="Total Shops"
          value={stats.totalShops}
          icon={Store}
        />
        <AdminStatsCard
          title="Transactions"
          value={stats.totalTransactions}
          icon={TrendingUp}
        />
        <AdminStatsCard
          title="Food Saved"
          value={`${stats.foodSavedKg} kg`}
          icon={FileText}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Shop Verification Report
            </CardTitle>
            <CardDescription>
              Download detailed report of shop verifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => downloadReport("Shop Verification")} className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Download Report
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              User Activity Report
            </CardTitle>
            <CardDescription>
              Download user growth and engagement metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => downloadReport("User Activity")} className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Download Report
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Food Waste Reduction Report
            </CardTitle>
            <CardDescription>
              Track environmental impact and waste reduction
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => downloadReport("Food Waste")} className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Download Report
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="w-5 h-5" />
              Complaint Resolution Report
            </CardTitle>
            <CardDescription>
              Summary of complaints and resolution rates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => downloadReport("Complaints")} className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Download Report
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
          <CardDescription>
            Track all administrative actions and system changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Audit logs provide a comprehensive record of all admin activities for security and compliance.
          </p>
          <Button onClick={() => downloadReport("Audit Logs")} className="mt-4">
            <Download className="w-4 h-4 mr-2" />
            Download Audit Logs
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminReports;
