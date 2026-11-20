import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

/** Home: estado vacío hasta que el proyecto le dé contenido. */
export function HomePage() {
  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyTitle>Home</EmptyTitle>
        <EmptyDescription>Content for this section appears here.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
