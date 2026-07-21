import { RouteSkeleton } from "@/components/route-skeleton"

// Rendered inside the AMR layout (which already adds the top offset + tab bar),
// so this only needs the sidebar offset.
export default function Loading() {
  return <RouteSkeleton variant="default" offset="ml-16" />
}
