import { describe, it, expect } from "vitest";
import { filterSortSessions, sortProjects, type FilterOptions } from "./filter";
import type { ProjectGroup } from "./components/Sidebar";
import { makeSession } from "./test/factory";

const base: FilterOptions = {
  search: "",
  filter: { type: "all" },
  favorites: new Set<string>(),
  sortKey: "lastActive",
  sortDir: "desc",
};

describe("filterSortSessions", () => {
  it("returns all sessions sorted newest-first by lastActive", () => {
    const a = makeSession({ id: "a", lastActive: "2026-01-01T00:00:00Z" });
    const b = makeSession({ id: "b", lastActive: "2026-03-01T00:00:00Z" });
    const c = makeSession({ id: "c", lastActive: "2026-02-01T00:00:00Z" });
    const out = filterSortSessions([a, b, c], base);
    expect(out.map((s) => s.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts by created when sortKey is created", () => {
    const a = makeSession({ id: "a", created: "2026-05-01T00:00:00Z" });
    const b = makeSession({ id: "b", created: "2026-01-01T00:00:00Z" });
    const out = filterSortSessions([a, b], { ...base, sortKey: "created" });
    expect(out.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("reverses to oldest-first when sortDir is asc", () => {
    const a = makeSession({ id: "a", lastActive: "2026-01-01T00:00:00Z" });
    const b = makeSession({ id: "b", lastActive: "2026-03-01T00:00:00Z" });
    const c = makeSession({ id: "c", lastActive: "2026-02-01T00:00:00Z" });
    const out = filterSortSessions([a, b, c], { ...base, sortDir: "asc" });
    expect(out.map((s) => s.id)).toEqual(["a", "c", "b"]);
  });

  it("respects sortDir asc when sorting by created", () => {
    const a = makeSession({ id: "a", created: "2026-05-01T00:00:00Z" });
    const b = makeSession({ id: "b", created: "2026-01-01T00:00:00Z" });
    const out = filterSortSessions([a, b], {
      ...base,
      sortKey: "created",
      sortDir: "asc",
    });
    expect(out.map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("places a missing sort timestamp first when sorting ascending", () => {
    const a = makeSession({ id: "a", lastActive: null });
    const b = makeSession({ id: "b", lastActive: "2026-01-01T00:00:00Z" });
    const out = filterSortSessions([a, b], { ...base, sortDir: "asc" });
    expect(out.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("treats a missing sort timestamp as oldest", () => {
    const a = makeSession({ id: "a", lastActive: null });
    const b = makeSession({ id: "b", lastActive: "2026-01-01T00:00:00Z" });
    const out = filterSortSessions([a, b], base);
    expect(out.map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("does not mutate the input array", () => {
    const input = [
      makeSession({ id: "a", lastActive: "2026-01-01T00:00:00Z" }),
      makeSession({ id: "b", lastActive: "2026-02-01T00:00:00Z" }),
    ];
    const snapshot = input.map((s) => s.id);
    filterSortSessions(input, base);
    expect(input.map((s) => s.id)).toEqual(snapshot);
  });

  it("filters to favorites only", () => {
    const a = makeSession({ id: "a" });
    const b = makeSession({ id: "b" });
    const out = filterSortSessions([a, b], {
      ...base,
      filter: { type: "favorites" },
      favorites: new Set(["b"]),
    });
    expect(out.map((s) => s.id)).toEqual(["b"]);
  });

  it("filters to a single project dir", () => {
    const a = makeSession({ id: "a", projectDir: "-proj-one" });
    const b = makeSession({ id: "b", projectDir: "-proj-two" });
    const out = filterSortSessions([a, b], {
      ...base,
      filter: { type: "project", dir: "-proj-two" },
    });
    expect(out.map((s) => s.id)).toEqual(["b"]);
  });

  it("searches across name, first and last message, case-insensitively", () => {
    const byName = makeSession({ id: "n", name: "Refactor Parser", firstMessage: null, lastMessage: null });
    const byFirst = makeSession({ id: "f", name: null, firstMessage: "help with REFACTOR", lastMessage: null });
    const byLast = makeSession({ id: "l", name: null, firstMessage: null, lastMessage: "refactor done" });
    const miss = makeSession({ id: "m", name: "unrelated", firstMessage: "nope", lastMessage: "nada" });

    const out = filterSortSessions([byName, byFirst, byLast, miss], {
      ...base,
      search: "refactor",
    });
    expect(out.map((s) => s.id).sort()).toEqual(["f", "l", "n"]);
  });

  it("ignores null fields when building the search haystack", () => {
    const s = makeSession({ id: "s", name: null, firstMessage: null, lastMessage: "only last" });
    expect(filterSortSessions([s], { ...base, search: "only" })).toHaveLength(1);
    expect(filterSortSessions([s], { ...base, search: "missing" })).toHaveLength(0);
  });

  it("combines a project filter with a search query", () => {
    const a = makeSession({ id: "a", projectDir: "-p1", name: "alpha" });
    const b = makeSession({ id: "b", projectDir: "-p1", name: "beta" });
    const c = makeSession({ id: "c", projectDir: "-p2", name: "alpha" });
    const out = filterSortSessions([a, b, c], {
      ...base,
      filter: { type: "project", dir: "-p1" },
      search: "alpha",
    });
    expect(out.map((s) => s.id)).toEqual(["a"]);
  });
});

describe("sortProjects", () => {
  const projects: ProjectGroup[] = [
    { dir: "-a", label: "apple", count: 1 },
    { dir: "-b", label: "banana", count: 2 },
    { dir: "-c", label: "cherry", count: 3 },
  ];

  it("sorts alphabetically by label when nothing is favorited", () => {
    const out = sortProjects(projects, new Set());
    expect(out.map((p) => p.dir)).toEqual(["-a", "-b", "-c"]);
  });

  it("pins favorited projects to the top, each group still alphabetical", () => {
    const out = sortProjects(projects, new Set(["-c"]));
    expect(out.map((p) => p.dir)).toEqual(["-c", "-a", "-b"]);
  });

  it("keeps favorites alphabetical among themselves", () => {
    const out = sortProjects(projects, new Set(["-c", "-b"]));
    expect(out.map((p) => p.dir)).toEqual(["-b", "-c", "-a"]);
  });

  it("does not mutate the input array", () => {
    const snapshot = projects.map((p) => p.dir);
    sortProjects(projects, new Set(["-c"]));
    expect(projects.map((p) => p.dir)).toEqual(snapshot);
  });
});
