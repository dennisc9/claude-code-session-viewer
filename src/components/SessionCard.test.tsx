import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionCard } from "./SessionCard";
import { makeSession } from "../test/factory";

function setup(sessionOverrides = {}) {
  const handlers = {
    onToggleFavorite: vi.fn(),
    onRename: vi.fn().mockResolvedValue(undefined),
    onResume: vi.fn(),
    onFinder: vi.fn(),
    onVscode: vi.fn(),
  };
  const session = makeSession(sessionOverrides);
  render(
    <SessionCard
      session={session}
      isFavorite={false}
      onToggleFavorite={handlers.onToggleFavorite}
      onRename={handlers.onRename}
      onResume={handlers.onResume}
      onFinder={handlers.onFinder}
      onVscode={handlers.onVscode}
    />,
  );
  return { session, ...handlers };
}

describe("SessionCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the session name, formatted model and tokens", () => {
    setup({ name: "My Session", model: "claude-opus-4-7", totalTokens: 2500 });
    expect(screen.getByText("My Session")).toBeInTheDocument();
    expect(screen.getByText("Opus 4.7")).toBeInTheDocument();
    expect(screen.getByText("2.5k tok")).toBeInTheDocument();
  });

  it("falls back to 'Untitled session' when name is null", () => {
    setup({ name: null });
    expect(screen.getByText("Untitled session")).toBeInTheDocument();
  });

  it("shows first and last message snippets", () => {
    setup({ firstMessage: "the very first", lastMessage: "the very last" });
    expect(screen.getByText("the very first")).toBeInTheDocument();
    expect(screen.getByText("the very last")).toBeInTheDocument();
  });

  it("calls onToggleFavorite when the star is clicked", async () => {
    const user = userEvent.setup();
    const { onToggleFavorite, session } = setup();
    await user.click(screen.getByTitle("Favorite"));
    expect(onToggleFavorite).toHaveBeenCalledWith(session);
  });

  it("calls onResume when Copy resume is clicked", async () => {
    const user = userEvent.setup();
    const { onResume, session } = setup();
    await user.click(screen.getByRole("button", { name: "Copy resume" }));
    expect(onResume).toHaveBeenCalledWith(session);
  });

  it("calls onFinder with the session when there is a cwd", async () => {
    const user = userEvent.setup();
    const { onFinder, session } = setup({ cwd: "/Users/me/proj" });
    const btn = screen.getByRole("button", { name: "Open Finder" });
    expect(btn).toBeEnabled();
    await user.click(btn);
    expect(onFinder).toHaveBeenCalledWith(session);
  });

  it("disables Open Finder when the session has no cwd", () => {
    setup({ cwd: null });
    expect(screen.getByRole("button", { name: "Open Finder" })).toBeDisabled();
  });

  it("calls onVscode with the session when there is a cwd", async () => {
    const user = userEvent.setup();
    const { onVscode, session } = setup({ cwd: "/Users/me/proj" });
    const btn = screen.getByRole("button", { name: "Open VS Code" });
    expect(btn).toBeEnabled();
    await user.click(btn);
    expect(onVscode).toHaveBeenCalledWith(session);
  });

  it("disables Open VS Code when the session has no cwd", () => {
    setup({ cwd: null });
    expect(screen.getByRole("button", { name: "Open VS Code" })).toBeDisabled();
  });

  it("enters edit mode when the title is clicked", async () => {
    const user = userEvent.setup();
    setup({ name: "Editable" });
    await user.click(screen.getByText("Editable"));
    expect(screen.getByRole("textbox")).toHaveValue("Editable");
  });

  it("commits a changed title on Enter", async () => {
    const user = userEvent.setup();
    const { onRename, session } = setup({ name: "Old name" });
    await user.click(screen.getByText("Old name"));
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "New name{Enter}");
    expect(onRename).toHaveBeenCalledWith(session, "New name");
  });

  it("does not rename when the title is unchanged", async () => {
    const user = userEvent.setup();
    const { onRename } = setup({ name: "Same" });
    await user.click(screen.getByText("Same"));
    await user.type(screen.getByRole("textbox"), "{Enter}");
    expect(onRename).not.toHaveBeenCalled();
  });

  it("does not rename when the new title is blank", async () => {
    const user = userEvent.setup();
    const { onRename } = setup({ name: "Something" });
    await user.click(screen.getByText("Something"));
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "   {Enter}");
    expect(onRename).not.toHaveBeenCalled();
  });

  it("cancels editing on Escape without renaming", async () => {
    const user = userEvent.setup();
    const { onRename } = setup({ name: "Keep me" });
    await user.click(screen.getByText("Keep me"));
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "discarded{Escape}");
    expect(onRename).not.toHaveBeenCalled();
    // Back to display mode showing the original name.
    expect(screen.getByText("Keep me")).toBeInTheDocument();
  });
});
