import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/components/theme-provider";
import { Home, Library, Compass, Users, Settings, LogOut, BookMarked, Sun, Moon, MessageSquare, Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [email, setEmail] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setEmail(data.user?.email ?? "");
      if (data.user) {
        const { data: r } = await supabase
          .from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
        setIsAdmin(!!r);
      }
    });
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-screen bg-background font-rounded">
      <aside className="sticky top-0 z-20 hidden h-screen w-20 flex-col items-center justify-between border-r-2 border-midnight/10 bg-coral py-6 md:flex">
        <div className="flex flex-col items-center gap-8">
          <Link to="/" className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white">
            <BookMarked className="h-5 w-5" />
          </Link>
          <nav className="flex flex-col items-center gap-1">
            <NavIcon to="/dashboard" icon={Home} label="Home" />
            <NavIcon to="/shelf" icon={Library} label="Shelf" />
            <NavIcon to="/discover" icon={Compass} label="Discover" />
            <NavIcon to="/friends" icon={Users} label="Friends" />
            <NavIcon to="/clubs" icon={Users} label="Clubs" />
            <NavIcon to="/feedback" icon={MessageSquare} label="Feedback" />
            <NavIcon to="/settings" icon={Settings} label="Settings" />
            {isAdmin && <NavIcon to="/admin" icon={Shield} label="Admin" />}
          </nav>
        </div>
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={toggle}
            title={theme === "dark" ? "Candlelight" : "Midnight study"}
            className="rounded-full p-3 text-white/70 hover:bg-white/15 hover:text-white"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            onClick={signOut}
            title={email}
            className="rounded-full p-3 text-white/70 hover:bg-white/15 hover:text-white"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </aside>

      <div className="flex-1">
        <Outlet />
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-20 flex justify-around border-t-2 border-midnight/10 bg-coral py-3 md:hidden">
        <NavIcon to="/dashboard" icon={Home} label="Home" />
        <NavIcon to="/shelf" icon={Library} label="Shelf" />
        <NavIcon to="/discover" icon={Compass} label="Discover" />
        <NavIcon to="/clubs" icon={Users} label="Clubs" />
        <NavIcon to="/feedback" icon={MessageSquare} label="Feedback" />
        <NavIcon to="/settings" icon={Settings} label="Settings" />
        {isAdmin && <NavIcon to="/admin" icon={Shield} label="Admin" />}
        <button onClick={toggle} className="rounded-full p-2 text-white/80">
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </nav>
    </div>
  );
}

function NavIcon({
  to, icon: Icon, label,
}: {
  to: "/dashboard" | "/shelf" | "/discover" | "/friends" | "/clubs" | "/feedback" | "/settings" | "/admin";
  icon: typeof Home; label: string;
}) {
  return (
    <Link
      to={to}
      activeProps={{ className: "bg-white text-coral" }}
      className="group relative rounded-full p-3 text-white/80 transition hover:bg-white/15 hover:text-white"
    >
      <Icon className="h-5 w-5" />
      <span className="pointer-events-none absolute left-full top-1/2 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-full bg-midnight px-2.5 py-1 font-rounded text-xs font-semibold text-white group-hover:block md:opacity-0 md:group-hover:opacity-100">
        {label}
      </span>
    </Link>
  );
}
