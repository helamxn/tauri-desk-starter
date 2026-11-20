import { createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { createAppRouter } from "./router";

const atPath = (path: string) => createAppRouter(createMemoryHistory({ initialEntries: [path] }));

describe("App routing", () => {
  it("opens Home with navigation", async () => {
    render(<App router={atPath("/")} />);
    expect(await screen.findByText("Home", { selector: "[data-slot=empty-title]" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Sections" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Example" })).not.toHaveAttribute("aria-current");
  });

  it("marks Example active after navigation", async () => {
    render(<App router={atPath("/")} />);
    await userEvent.click(await screen.findByRole("link", { name: "Example" }));
    expect(await screen.findByText("Example", { selector: "[data-slot=empty-title]" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Example" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });
});
