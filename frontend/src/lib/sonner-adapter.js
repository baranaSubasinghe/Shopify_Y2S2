import { toast as sonner } from "sonner";

export function toast({ title, description, variant } = {}) {
  if (!title && description) {
    return sonner(description);
  }
  if (variant === "destructive") {
    return sonner.error(title || "Error", description ? { description } : undefined);
  }
  if (description) {
    return sonner(title || "", { description });
  }
  return sonner(title || "");
}
