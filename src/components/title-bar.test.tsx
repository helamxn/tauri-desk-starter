import { screen } from "@testing-library/react";
import { renderInRouter } from "@/test/router";
import { TitleBar } from "./title-bar";

describe("TitleBar", () => {
  it("provides a drag region alongside navigation", async () => {
    await renderInRouter(<TitleBar inTauri={false} />);
    const bar = screen.getByRole("banner");
    expect(bar).toHaveAttribute("data-tauri-drag-region");
    expect(screen.getByRole("navigation", { name: "Sections" })).toBeInTheDocument();
    // Los enlaces no arrastran: Tauri solo arrastra desde el elemento que lleva el atributo.
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("data-tauri-drag-region");
  });
});
