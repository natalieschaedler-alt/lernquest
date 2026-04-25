/**
 * Main app shell. Wraps every route under /(main) with the sticky Header and
 * the mobile BottomTabBar. Pages render between the two and own their own
 * vertical rhythm.
 */
import { Header } from "@/components/layout/Header";
import { BottomTabBar } from "@/components/layout/BottomTabBar";

export default function MainLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <Header />
      {/* pb-20 reserves space for the fixed mobile tab-bar; reset on lg+ */}
      <main className="flex-1 pb-20 lg:pb-0">{children}</main>
      <BottomTabBar />
    </div>
  );
}
