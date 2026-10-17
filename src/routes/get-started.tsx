import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Check, Code2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { HomeFooter, HomeNav } from "@/components/home";
import { Button } from "@/components/ui/button";
import type { AppRole } from "@/types";

export const Route = createFileRoute("/get-started")({
  validateSearch: z.object({
    role: z.enum(["manager", "developer"]).optional().catch(undefined),
  }),
  head: () => ({
    meta: [
      { title: "Get started — Northpeak" },
      {
        name: "description",
        content: "Choose the Northpeak workspace perspective that fits how you work.",
      },
    ],
  }),
  component: GetStartedPage,
});

const roleOptions: Array<{
  value: AppRole;
  label: string;
  description: string;
  detail: string;
  icon: typeof Code2;
}> = [
  {
    value: "developer",
    label: "Developer",
    description: "Keep delivery moving.",
    detail: "Focus on assigned tasks, subtasks, comments, and the next deadline that matters.",
    icon: Code2,
  },
  {
    value: "manager",
    label: "Manager",
    description: "See the sprint clearly.",
    detail: "Coordinate projects, capacity, priorities, and overdue work from one view.",
    icon: BriefcaseBusiness,
  },
];

function GetStartedPage() {
  const navigate = useNavigate();
  const { role: roleFromSearch } = Route.useSearch();
  const [selectedRole, setSelectedRole] = useState<AppRole>(roleFromSearch ?? "developer");

  function continueToRegistration() {
    void navigate({ to: "/register", search: { role: selectedRole } });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <HomeNav />
      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-4 py-12 sm:px-6 sm:py-20">
        <div className="w-full">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft className="size-4" />
            Back to home
          </Link>
          <div className="mt-10 max-w-2xl">
            <p className="text-sm font-semibold text-primary">Start with your perspective</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              How will you use Northpeak?
            </h1>
            <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
              Choose the view that matches your day-to-day work. You can refine your workspace after
              creating an account.
            </p>
          </div>

          <div
            className="mt-10 grid gap-4 md:grid-cols-2"
            role="radiogroup"
            aria-label="Choose your Northpeak role"
          >
            {roleOptions.map((option) => {
              const selected = selectedRole === option.value;
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setSelectedRole(option.value)}
                  className={`group relative rounded-2xl border p-6 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    selected
                      ? "border-primary bg-primary-soft"
                      : "border-border bg-card hover:border-primary/50 hover:bg-secondary/50"
                  }`}
                >
                  <span
                    className={`flex size-12 items-center justify-center rounded-xl ${
                      selected ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"
                    }`}
                  >
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <span className="mt-6 block text-xl font-bold">{option.label}</span>
                  <span className="mt-2 block text-base font-medium text-foreground">
                    {option.description}
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                    {option.detail}
                  </span>
                  <span
                    className={`absolute right-5 top-5 flex size-6 items-center justify-center rounded-full border ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-transparent"
                    }`}
                    aria-hidden
                  >
                    <Check className="size-4" />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-xs leading-5 text-muted-foreground">
              Role selection personalizes onboarding only. Northpeak’s server decides account roles
              and permissions.
            </p>
            <Button size="lg" onClick={continueToRegistration} className="shrink-0">
              Continue to registration
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </main>
      <HomeFooter />
    </div>
  );
}
