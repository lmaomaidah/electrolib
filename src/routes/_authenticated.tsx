import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/components/theme-provider";
import { Home, Library, Compass, Users, Settings, LogOut, BookMarked, Sun, Moon } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 z-20 hidden h-screen w-20 flex-col items-center justify-between border-r border-border bg-aged py-6 md:flex">
        <div className="flex flex-col items-center gap-8">
          <Link to="/" className="flex flex-col items-center">
            <BookMarked className="h-7 w-7 text-mahogany" />
          </Link>
          <nav className="flex flex-col items-center gap-2">
            <NavIcon to="/dashboard" icon={Home} label="Home" />
            <NavIcon to="/shelf" icon={Library} label="Shelf" />
            <NavIcon to="/discover" icon={Compass} label="Discover" />
            <NavIcon to="/friends" icon={Users} label="Friends" />
            <NavIcon to="/settings" icon={Settings} label="Settings" />
          </nav>
        </div>
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={toggle}
            title={theme === "dark" ? "Candlelight" : "Midnight study"}
            className="rounded-full p-3 text-walnut/60 hover:bg-parchment hover:text-walnut"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            onClick={signOut}
            title={email}
            className="rounded-full p-3 text-walnut/60 hover:bg-parchment hover:text-walnut"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </aside>

      <div className="flex-1">
        <Outlet />
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-20 flex justify-around border-t border-border bg-aged py-3 md:hidden">
        <NavIcon to="/dashboard" icon={Home} label="Home" />
        <NavIcon to="/shelf" icon={Library} label="Shelf" />
        <NavIcon to="/discover" icon={Compass} label="Discover" />
        <NavIcon to="/friends" icon={Users} label="Friends" />
        <NavIcon to="/settings" icon={Settings} label="Settings" />
        <button onClick={toggle} className="rounded-full p-2 text-walnut/60">
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </nav>
    </div>
  );
}

function NavIcon({
  to, icon: Icon, label,
}: {
  to: "/dashboard" | "/shelf" | "/discover" | "/friends" | "/settings";
  icon: typeof Home; label: string;
}) {
  return (
    <Link
      to={to}
      activeProps={{ className: "bg-mahogany text-aged" }}
      className="group relative rounded-full p-3 text-walnut/60 transition hover:bg-parchment hover:text-walnut"
    >
      <Icon className="h-5 w-5" />
      <span className="pointer-events-none absolute left-full top-1/2 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded bg-walnut px-2 py-1 font-hand text-xs text-aged group-hover:block md:opacity-0 md:group-hover:opacity-100">
        {label}
      </span>
    </Link>
  );
}
