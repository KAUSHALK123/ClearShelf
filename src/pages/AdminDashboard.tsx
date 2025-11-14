import { useEffect, useState } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminStatsCard from "@/components/admin/AdminStatsCard";
import { Store, Users, Package, AlertCircle, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Analytics {
  totalShops: number;
  pendingShops: number;
  verifiedShops: number;
  totalUsers: { customer: number; shopkeeper: number; admin: number };
  totalProducts: number;
  expiringProducts: number;
  totalTransactions: number;
  revenueThisMonth: number;
  foodSavedKg: number;
  pendingComplaints: number;
  dailyStats: Array<{ date: string; shops: number; users: number }>;
  topShops: Array<{ shopId: string; name: string; revenue: number; productsSold: number }>;
}

const AdminDashboard = () => {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-analytics`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const shopStatusData = analytics ? [
    { name: 'Verified', value: analytics.verifiedShops, color: '#10b981' },
    { name: 'Pending', value: analytics.pendingShops, color: '#f59e0b' },
    { name: 'Rejected', value: analytics.totalShops - analytics.verifiedShops - analytics.pendingShops, color: '#ef4444' },
  ] : [];

  const userDistribution = analytics ? [
    { name: 'Customers', value: analytics.totalUsers.customer },
    { name: 'Shopkeepers', value: analytics.totalUsers.shopkeeper },
    { name: 'Admins', value: analytics.totalUsers.admin },
  ] : [];

  if (loading) {
    return (
      <div>
        <AdminHeader title="Dashboard" />
        <div className="p-6">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AdminHeader title="Dashboard" />
      
      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <AdminStatsCard
            title="Total Shops"
            value={analytics?.totalShops || 0}
            icon={Store}
            trend={{ value: 12, isPositive: true }}
          />
          <AdminStatsCard
            title="Active Users"
            value={analytics ? analytics.totalUsers.customer + analytics.totalUsers.shopkeeper : 0}
            icon={Users}
            trend={{ value: 8, isPositive: true }}
          />
          <AdminStatsCard
            title="Total Products"
            value={analytics?.totalProducts || 0}
            icon={Package}
          />
          <AdminStatsCard
            title="Pending Actions"
            value={(analytics?.pendingShops || 0) + (analytics?.pendingComplaints || 0)}
            icon={AlertCircle}
            className="border-orange-200 dark:border-orange-800"
          />
        </div>

        {/* Impact Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Revenue This Month
              </CardTitle>
              <CardDescription>Total revenue from all shops</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-primary">
                ₹{analytics?.revenueThisMonth.toFixed(2) || 0}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <img src="/clearshelf-logo.png" alt="ClearShelf" className="w-5 h-5 object-contain" />
                Food Saved from Waste
              </CardTitle>
              <CardDescription>Environmental impact tracker</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-green-600 dark:text-green-400">
                {analytics?.foodSavedKg.toFixed(0) || 0} kg
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                ~{((analytics?.foodSavedKg || 0) * 2.5).toFixed(0)} kg CO₂ saved
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Registration Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Registration Trends (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics?.dailyStats || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="shops" stroke="#10b981" name="Shops" />
                  <Line type="monotone" dataKey="users" stroke="#3b82f6" name="Users" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Shop Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Shop Verification Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={shopStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {shopStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* User Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>User Distribution by Role</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={userDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Performing Shops */}
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Shops</CardTitle>
              <CardDescription>By revenue this month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics?.topShops.slice(0, 5).map((shop, index) => (
                  <div key={shop.shopId} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{shop.name}</p>
                        <p className="text-sm text-muted-foreground">{shop.productsSold} products sold</p>
                      </div>
                    </div>
                    <p className="font-bold text-primary">₹{shop.revenue.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
