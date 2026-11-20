import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "./error-boundary";

function BrokenComponent(): never {
  throw new Error("se rompió");
}

describe("ErrorBoundary and ErrorScreen", () => {
  it("shows a recovery screen and reports the error to the root", () => {
    const onCaughtError = vi.fn();
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>,
      { onCaughtError },
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(onCaughtError).toHaveBeenCalledTimes(1);
  });

  it("reloads the page on request", async () => {
    const reload = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ reload: reload } as unknown as Location);
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>,
      { onCaughtError: () => undefined },
    );
    await userEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("renders children when healthy", () => {
    render(
      <ErrorBoundary>
        <p>contenido</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("contenido")).toBeInTheDocument();
  });
});
