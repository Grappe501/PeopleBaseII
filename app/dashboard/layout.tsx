import type { ReactNode } from "react";

export const metadata = {
  title: "Dashboard | PeopleBaseII",
  description: "Statewide race command center for PeopleBaseII",
};

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
