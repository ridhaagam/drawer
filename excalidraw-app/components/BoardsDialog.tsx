import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { TextField } from "@excalidraw/excalidraw/components/TextField";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { useState } from "react";

import { forgetBoard, loadBoards, renameBoard } from "../data/boards";

import "./BoardsDialog.scss";

import type { Board } from "../data/boards";

const formatLastOpened = (timestamp: number) => {
  const days = Math.floor((Date.now() - timestamp) / 86400000);

  if (days === 0) {
    return "today";
  }
  if (days === 1) {
    return "yesterday";
  }
  return `${days} days ago`;
};

export const BoardsDialog = ({ onClose }: { onClose: () => void }) => {
  const [boards, setBoards] = useState<Board[]>(() => loadBoards());
  const [editing, setEditing] = useState<string | null>(null);

  const refresh = () => setBoards(loadBoards());

  return (
    <Dialog onCloseRequest={onClose} title="Boards" size="regular">
      <div className="BoardsDialog">
        {boards.length === 0 ? (
          <p className="BoardsDialog__empty">
            Boards you start or join appear here. The key in a board&apos;s link
            is the only credential there is, so anyone with the link has full
            access, and a lost link cannot be recovered.
          </p>
        ) : (
          <ul className="BoardsDialog__list">
            {boards.map((board) => (
              <li key={board.roomId} className="BoardsDialog__row">
                {editing === board.roomId ? (
                  <TextField
                    value={board.name}
                    placeholder="Board name"
                    onChange={(value) => {
                      renameBoard(board.roomId, value);
                      refresh();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        setEditing(null);
                      }
                    }}
                  />
                ) : (
                  <a className="BoardsDialog__link" href={board.link}>
                    <span className="BoardsDialog__name">
                      {board.name || board.roomId}
                    </span>
                    <span className="BoardsDialog__meta">
                      {formatLastOpened(board.lastOpened)}
                    </span>
                  </a>
                )}
                <div className="BoardsDialog__actions">
                  <FilledButton
                    variant="outlined"
                    color="muted"
                    size="medium"
                    label={editing === board.roomId ? "Done" : "Rename"}
                    onClick={() =>
                      setEditing(editing === board.roomId ? null : board.roomId)
                    }
                  />
                  <FilledButton
                    variant="outlined"
                    color="danger"
                    size="medium"
                    label="Remove"
                    onClick={() => {
                      forgetBoard(board.roomId);
                      refresh();
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
};
