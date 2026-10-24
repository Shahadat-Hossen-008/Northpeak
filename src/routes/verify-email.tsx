import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/verify-email")({
  validateSearch: z.object({
    email: z.string().email().catch(""),
    role: z.enum(["manager", "developer"]).optional().catch(undefined),
  }),
  head: () => ({
    meta: [
      { title: "Verify your email | Northpeak" },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/register",
      search: {
        step: "verify",
        email: search.email || undefined,
        role: search.role,
      },
      replace: true,
    });
  },
  component: () => null,
});

export default Route;
