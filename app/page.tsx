import { redirect } from "next/navigation";

export default function Home() {
  // Automatically send visitors to the login page
  redirect("/login");
}