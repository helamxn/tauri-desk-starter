import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

/** Example: estado vacío, como Home, hasta que el proyecto le dé contenido. */
export function ExamplePage() {
  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyTitle>Example</EmptyTitle>
        <EmptyDescription>Content for this section appears here.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
