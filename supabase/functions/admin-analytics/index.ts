import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin role
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has admin role
    const { data: hasAdminRole } = await supabaseClient
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (!hasAdminRole) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get shop statistics
    const { data: shops } = await supabaseClient
      .from('shops')
      .select('verification_status');

    const totalShops = shops?.length || 0;
    const pendingShops = shops?.filter(s => s.verification_status === 'pending').length || 0;
    const verifiedShops = shops?.filter(s => s.verification_status === 'verified').length || 0;
    const rejectedShops = shops?.filter(s => s.verification_status === 'rejected').length || 0;

    // Get user statistics
    const { data: profiles } = await supabaseClient
      .from('profiles')
      .select('role');

    const totalUsers = {
      customer: profiles?.filter(p => p.role === 'customer').length || 0,
      shopkeeper: profiles?.filter(p => p.role === 'shopkeeper').length || 0,
      admin: profiles?.filter(p => p.role === 'admin').length || 0,
    };

    // Get product statistics
    const { count: totalProducts } = await supabaseClient
      .from('products')
      .select('*', { count: 'exact', head: true });

    const { data: expiringProducts } = await supabaseClient
      .from('inventory_batches')
      .select('quantity')
      .eq('status', 'active')
      .lte('expiry_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());

    const expiringProductsCount = expiringProducts?.length || 0;

    // Get transaction statistics
    const { count: totalTransactions } = await supabaseClient
      .from('transactions')
      .select('*', { count: 'exact', head: true });

    const { data: thisMonthTransactions } = await supabaseClient
      .from('transactions')
      .select('price, quantity')
      .gte('timestamp', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

    const revenueThisMonth = thisMonthTransactions?.reduce((sum, t) => sum + (Number(t.price) * t.quantity), 0) || 0;

    // Calculate food saved (estimate: products sold before expiry)
    const foodSavedKg = (totalTransactions || 0) * 0.5; // Assuming average 0.5kg per product

    // Get complaint statistics
    const { data: complaints } = await supabaseClient
      .from('complaints')
      .select('status');

    const pendingComplaints = complaints?.filter(c => c.status === 'pending').length || 0;
    const resolvedComplaints = complaints?.filter(c => c.status === 'resolved').length || 0;

    // Get daily stats for last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { data: dailyShops } = await supabaseClient
      .from('shops')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo.toISOString());

    const { data: dailyUsers } = await supabaseClient
      .from('profiles')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo.toISOString());

    // Group by date
    const dailyStats = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      const shopsCount = dailyShops?.filter(s => s.created_at.startsWith(dateStr)).length || 0;
      const usersCount = dailyUsers?.filter(u => u.created_at.startsWith(dateStr)).length || 0;
      
      dailyStats.unshift({ date: dateStr, shops: shopsCount, users: usersCount });
    }

    // Get top performing shops
    const { data: topShopsData } = await supabaseClient
      .from('transactions')
      .select('shop_id, shops(name), price, quantity')
      .limit(1000);

    const shopRevenue: Record<string, { name: string; revenue: number; productsSold: number }> = {};
    topShopsData?.forEach((t: any) => {
      const shopId = t.shop_id;
      if (!shopRevenue[shopId]) {
        shopRevenue[shopId] = { name: t.shops?.name || 'Unknown', revenue: 0, productsSold: 0 };
      }
      shopRevenue[shopId].revenue += Number(t.price) * t.quantity;
      shopRevenue[shopId].productsSold += t.quantity;
    });

    const topShops = Object.entries(shopRevenue)
      .map(([shopId, data]) => ({ shopId, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const analytics = {
      totalShops,
      pendingShops,
      verifiedShops,
      rejectedShops,
      totalUsers,
      totalProducts: totalProducts || 0,
      expiringProducts: expiringProductsCount,
      totalTransactions: totalTransactions || 0,
      revenueThisMonth,
      foodSavedKg,
      pendingComplaints,
      resolvedComplaints,
      dailyStats,
      topShops,
    };

    return new Response(JSON.stringify(analytics), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
