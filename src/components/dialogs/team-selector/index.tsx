import { Check, ChevronsUpDown, Search, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserAvatar } from "@/components/avatar";
import { cn } from "@/lib/utils";
import { useMembers } from "@/hooks/queries";
import type { ProjectTeamSelectorProps } from "./interface";

export function ProjectTeamSelector({
  selectedIds,
  onChange,
  disabled = false,
}: ProjectTeamSelectorProps) {
  const { data: members, isLoading } = useMembers();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const developers = useMemo(() => {
    return (members ?? []).filter((m) => m.role === "developer");
  }, [members]);

  const filteredDevelopers = useMemo(() => {
    if (!search.trim()) return developers;
    const q = search.toLowerCase().trim();
    return developers.filter(
      (d) => d.name.toLowerCase().includes(q) || (d.email && d.email.toLowerCase().includes(q)),
    );
  }, [developers, search]);

  const selectedDevelopers = useMemo(() => {
    return developers.filter((d) => selectedIds.includes(d.id));
  }, [developers, selectedIds]);

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  function remove(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    onChange(selectedIds.filter((item) => item !== id));
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <Label htmlFor="project-team-trigger">Assigned Engineering Team</Label>
        <span className="text-xs text-muted-foreground">
          {selectedIds.length} {selectedIds.length === 1 ? "developer" : "developers"} assigned
        </span>
      </div>

      {/* Selected tags */}
      {selectedDevelopers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 rounded-md bg-muted/40 border border-border/60">
          {selectedDevelopers.map((dev) => (
            <span
              key={dev.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-xs font-medium text-foreground border border-border shadow-xs"
            >
              <UserAvatar name={dev.name} size="sm" className="size-4 text-[9px]" />
              <span className="truncate max-w-30">{dev.name}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={(e) => remove(dev.id, e)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground focus-visible:outline-none cursor-pointer"
                aria-label={`Remove ${dev.name}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Popover trigger */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="project-team-trigger"
            type="button"
            variant="outline"
            role="combobox"
            aria-haspopup="dialog"
            aria-expanded={open}
            disabled={disabled || isLoading}
            className="w-full justify-between font-normal text-left h-auto py-2"
          >
            <span className="flex items-center gap-2 truncate text-sm">
              <Users className="size-4 text-muted-foreground shrink-0" />
              {isLoading ? (
                "Loading developers…"
              ) : selectedIds.length === 0 ? (
                <span className="text-muted-foreground">Assign developers to project team…</span>
              ) : (
                <span>Add / manage team members…</span>
              )}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-2" align="start">
          <div className="space-y-2">
            <div className="flex items-center gap-2 border-b border-border px-2 pb-2">
              <Search className="size-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                aria-label="Search developers by name or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                  }
                }}
                placeholder="Search by name or email…"
                className="w-full bg-transparent text-xs placeholder:text-muted-foreground focus-visible:outline-none"
              />
              {search && (
                <button
                  type="button"
                  aria-label="Clear developer search"
                  onClick={() => setSearch("")}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            <div className="max-h-52 overflow-y-auto space-y-1">
              {filteredDevelopers.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  {search ? "No matching developers found" : "No registered developers"}
                </p>
              ) : (
                filteredDevelopers.map((dev) => {
                  const isSelected = selectedIds.includes(dev.id);
                  return (
                    <button
                      key={dev.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggle(dev.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2.5 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted/80 cursor-pointer",
                        isSelected && "bg-muted/50 font-medium",
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <UserAvatar name={dev.name} size="sm" className="size-6 text-[10px]" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{dev.name}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{dev.email}</p>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "size-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground/40",
                        )}
                      >
                        {isSelected && <Check className="size-3" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default ProjectTeamSelector;
export type { ProjectTeamSelectorProps } from "./interface";
