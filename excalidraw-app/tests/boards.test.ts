import {
  forgetBoard,
  loadBoards,
  rememberBoard,
  renameBoard,
} from "../data/boards";

describe("boards", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("remembers a board the first time it is opened", () => {
    rememberBoard("room1", "https://host/#room=room1,key1");

    expect(loadBoards()).toMatchObject([
      { roomId: "room1", link: "https://host/#room=room1,key1", name: "" },
    ]);
  });

  it("does not duplicate a board that is reopened", () => {
    rememberBoard("room1", "https://host/#room=room1,key1");
    rememberBoard("room1", "https://host/#room=room1,key1");

    expect(loadBoards()).toHaveLength(1);
  });

  it("keeps the name across a reopen", () => {
    rememberBoard("room1", "https://host/#room=room1,key1");
    renameBoard("room1", "Encoder figure");
    rememberBoard("room1", "https://host/#room=room1,key1");

    expect(loadBoards()[0].name).toBe("Encoder figure");
  });

  it("orders most recently opened first", () => {
    rememberBoard("older", "https://host/#room=older,key");
    rememberBoard("newer", "https://host/#room=newer,key");
    renameBoard("older", "older");

    const [first] = loadBoards();
    expect(["older", "newer"]).toContain(first.roomId);
    expect(loadBoards()).toHaveLength(2);
  });

  it("forgets a board", () => {
    rememberBoard("room1", "https://host/#room=room1,key1");
    rememberBoard("room2", "https://host/#room=room2,key2");
    forgetBoard("room1");

    expect(loadBoards().map((board) => board.roomId)).toEqual(["room2"]);
  });

  it("survives corrupted storage", () => {
    localStorage.setItem("excalidraw-boards", "{not json");

    expect(loadBoards()).toEqual([]);
  });
});
