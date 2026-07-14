import type { Metadata } from "next";

import "../styles/admin.css";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: {
    default: "Prelog 管理台",
    template: "%s | Prelog 管理台",
  },
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="admin-app">{children}</div>;
}
