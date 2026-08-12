import { render } from "@excalidraw/excalidraw/tests/test-utils";
import { fireEvent, screen, waitFor } from "@testing-library/react";

import ExcalidrawApp from "../App";
import { rememberBoard, renameBoard } from "../data/boards";

const openBoardsDialog = async () => {
  fireEvent.click(document.querySelector(".dropdown-menu-button")!);
  fireEvent.click(await screen.findByText("Boards"));
};

describe("Boards dialog", () => {
  it("lists a saved board and links to it", async () => {
    rememberBoard("room1", "http://localhost/#room=room1,key1");
    renameBoard("room1", "Encoder figure");

    await render(<ExcalidrawApp />);
    await openBoardsDialog();

    await waitFor(() => {
      const link = screen.getByText("Encoder figure").closest("a");
      expect(link?.getAttribute("href")).toBe(
        "http://localhost/#room=room1,key1",
      );
    });
  });

  it("explains that the link is the only credential when empty", async () => {
    localStorage.clear();

    await render(<ExcalidrawApp />);
    await openBoardsDialog();

    await waitFor(() => {
      expect(screen.getByText(/only credential/i)).toBeTruthy();
    });
  });
});
