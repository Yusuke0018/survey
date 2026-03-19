import { redirect } from "next/navigation";
import { getSessionRole } from "@/lib/auth";

export default async function Home() {
  const role = await getSessionRole();
  if (role === "admin") {
    redirect("/dashboard");
  } else if (role === "staff") {
    redirect("/respond");
  } else {
    redirect("/login");
  }
}
