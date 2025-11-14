import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
// Leaf icon replaced by brand PNG
import { z } from "zod";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [isAdminLogin, setIsAdminLogin] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    role: "customer" as "customer" | "shopkeeper" | "admin",
  });

  // Validation schemas
  const signupSchema = z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name too long"),
    email: z.string().trim().email("Invalid email address").max(255, "Email too long"),
    phone: z.string().trim().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number").max(20, "Phone number too long"),
    password: z.string().min(6, "Password must be at least 6 characters").max(100, "Password too long")
  });

  const loginSchema = z.object({
    email: z.string().trim().email("Invalid email address").max(255, "Email too long"),
    password: z.string().min(6, "Password must be at least 6 characters").max(100, "Password too long")
  });

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        // Validate signup data
        signupSchema.parse({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password
        });
        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              name: formData.name,
              role: formData.role,
              phone: formData.phone,
            },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) throw error;

        toast({
          title: "Account created!",
          description: "You can now log in with your credentials.",
        });
        setMode("login");
      } else {
        // Validate login data
        loginSchema.parse({
          email: formData.email,
          password: formData.password
        });
        
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) throw error;

        const { data: { user } } = await supabase.auth.getUser();

        if (isAdminLogin) {
          // Check if user has admin role
          const { data: hasAdminRole } = await supabase
            .rpc('has_role', { _user_id: user?.id, _role: 'admin' });

          if (!hasAdminRole) {
            await supabase.auth.signOut();
            throw new Error("You don't have admin privileges");
          }

          toast({
            title: "Welcome, Admin!",
            description: "Redirecting you to admin panel...",
          });

          navigate("/admin");
        } else {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user?.id)
            .single();

          toast({
            title: "Welcome back!",
            description: "Redirecting you to your dashboard...",
          });

          if (profile?.role === "shopkeeper") {
            navigate("/shopkeeper");
          } else {
            navigate("/customer");
          }
        }
      }
    } catch (error: any) {
      const errorMessage = error instanceof z.ZodError 
        ? error.errors[0].message 
        : error.message;
      
      toast({
        title: "Validation Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary rounded-full">
              <img src="/clearshelf-logo.png" alt="ClearShelf" className="w-8 h-8 object-contain" />
            </div>
          </div>
          <CardTitle className="text-2xl">Clear Shelf</CardTitle>
          <CardDescription>Great Deals, Zero Food Waste</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "signup")}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleAuth} className="space-y-4">
                {isAdminLogin && (
                  <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <p className="text-sm font-medium text-primary">Admin Login Mode</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter admin credentials to access the admin panel
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Loading..." : isAdminLogin ? "Log In as Admin" : "Log In"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-sm"
                  onClick={() => setIsAdminLogin(!isAdminLogin)}
                >
                  {isAdminLogin ? "← Back to regular login" : "Login as Admin →"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-signup">Email</Label>
                  <Input
                    id="email-signup"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-signup">Password</Label>
                  <Input
                    id="password-signup"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label>I am a</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant={formData.role === "customer" ? "default" : "outline"}
                      onClick={() => setFormData({ ...formData, role: "customer" })}
                    >
                      Customer
                    </Button>
                    <Button
                      type="button"
                      variant={formData.role === "shopkeeper" ? "default" : "outline"}
                      onClick={() => setFormData({ ...formData, role: "shopkeeper" })}
                    >
                      Shopkeeper
                    </Button>
                    <Button
                      type="button"
                      variant={formData.role === "admin" ? "default" : "outline"}
                      onClick={() => setFormData({ ...formData, role: "admin" })}
                    >
                      Admin
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : "Sign Up"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;