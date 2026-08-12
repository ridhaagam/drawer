import { STORAGE_KEYS } from "../app_constants";

export type Board = {
  roomId: string;
  name: string;
  link: string;
  lastOpened: number;
};

const MAX_BOARDS = 100;

// Boards live only in this browser. Putting the list on the server would mean
// the server learning a board's name, which is metadata the end-to-end
// encryption otherwise keeps from it.
const read = (): Board[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_BOARDS);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(
          (board): board is Board =>
            typeof board?.roomId === "string" &&
            typeof board?.link === "string",
        )
      : [];
  } catch (error: any) {
    console.error(error);
    return [];
  }
};

const write = (boards: Board[]) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_BOARDS,
      JSON.stringify(boards.slice(0, MAX_BOARDS)),
    );
  } catch (error: any) {
    console.error(error);
  }
};

export const loadBoards = (): Board[] =>
  read().sort((a, b) => b.lastOpened - a.lastOpened);

export const rememberBoard = (roomId: string, link: string) => {
  const boards = read();
  const existing = boards.find((board) => board.roomId === roomId);

  if (existing) {
    existing.link = link;
    existing.lastOpened = Date.now();
  } else {
    boards.push({
      roomId,
      name: "",
      link,
      lastOpened: Date.now(),
    });
  }

  write(boards);
};

export const renameBoard = (roomId: string, name: string) => {
  const boards = read();
  const board = boards.find((entry) => entry.roomId === roomId);

  if (board) {
    board.name = name;
    write(boards);
  }
};

export const forgetBoard = (roomId: string) => {
  write(read().filter((board) => board.roomId !== roomId));
};
