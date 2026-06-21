import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar, type Filter, type ProjectGroup } from "./Sidebar";

const projects: ProjectGroup[] = [
  { dir: "-Users-me-alpha", label: "alpha", count: 3 },
  { dir: "-Users-me-beta", label: "beta", count: 1 },
];

function setup(
  filter: Filter = { type: "all" },
  favoriteProjects: Set<string> = new Set(),
) {
  const onSelect = vi.fn();
  const onToggleFavoriteProject = vi.fn();
  render(
    <Sidebar
      projects={projects}
      totalCount={4}
      favoritesCount={2}
      filter={filter}
      onSelect={onSelect}
      favoriteProjects={favoriteProjects}
      onToggleFavoriteProject={onToggleFavoriteProject}
      width={220}
    />,
  );
  return { onSelect, onToggleFavoriteProject };
}

describe("Sidebar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the All and Favorites counts", () => {
    setup();
    expect(screen.getByText("All sessions").parentElement).toHaveTextContent("4");
    expect(screen.getByText("Favorites").closest("button")).toHaveTextContent("2");
  });

  it("renders one nav item per project with its count", () => {
    setup();
    expect(screen.getByText("alpha").parentElement).toHaveTextContent("3");
    expect(screen.getByText("beta").parentElement).toHaveTextContent("1");
  });

  it("calls onSelect with the all filter", async () => {
    const user = userEvent.setup();
    const { onSelect } = setup({ type: "favorites" });
    await user.click(screen.getByText("All sessions"));
    expect(onSelect).toHaveBeenCalledWith({ type: "all" });
  });

  it("calls onSelect with the favorites filter", async () => {
    const user = userEvent.setup();
    const { onSelect } = setup();
    await user.click(screen.getByText("Favorites"));
    expect(onSelect).toHaveBeenCalledWith({ type: "favorites" });
  });

  it("calls onSelect with a project filter carrying the dir", async () => {
    const user = userEvent.setup();
    const { onSelect } = setup();
    await user.click(screen.getByText("alpha"));
    expect(onSelect).toHaveBeenCalledWith({
      type: "project",
      dir: "-Users-me-alpha",
    });
  });

  it("toggles a project favorite, passing the project dir", async () => {
    const user = userEvent.setup();
    const { onToggleFavoriteProject } = setup();
    // The empty star next to the first project (alpha) favorites it.
    await user.click(screen.getAllByLabelText("Favorite project")[0]);
    expect(onToggleFavoriteProject).toHaveBeenCalledWith("-Users-me-alpha");
  });

  it("renders a filled star for an already-favorited project", () => {
    setup({ type: "all" }, new Set(["-Users-me-alpha"]));
    const stars = screen.getAllByLabelText("Unfavorite project");
    expect(stars).toHaveLength(1);
    expect(stars[0]).toHaveClass("starred");
  });

  it("marks the active filter button with the active class", () => {
    setup({ type: "project", dir: "-Users-me-beta" });
    expect(screen.getByText("beta").closest("button")).toHaveClass("active");
    expect(screen.getByText("alpha").closest("button")).not.toHaveClass("active");
    expect(
      screen.getByText("All sessions").closest("button"),
    ).not.toHaveClass("active");
  });
});
