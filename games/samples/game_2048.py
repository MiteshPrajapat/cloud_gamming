"""
Built-in Lightweight 2048 Game for Cloud Gaming
Runs on Tkinter / X11 without requiring a GPU.
Controls: Arrow Keys or W/A/S/D to slide tiles, 'R' to restart, 'Q' or Esc to quit.
"""
import sys
import os
import random

try:
    import tkinter as tk
    import tkinter.font as tkFont
except ImportError:
    print("Tkinter not available in this environment.")
    sys.exit(0)

COLORS = {
    0: ("#cdc1b4", "#776e65"),
    2: ("#eee4da", "#776e65"),
    4: ("#ede0c8", "#776e65"),
    8: ("#f2b179", "#f9f6f2"),
    16: ("#f59563", "#f9f6f2"),
    32: ("#f67c5f", "#f9f6f2"),
    64: ("#f65e3b", "#f9f6f2"),
    128: ("#edcf72", "#f9f6f2"),
    256: ("#edcc61", "#f9f6f2"),
    512: ("#edc850", "#f9f6f2"),
    1024: ("#edc53f", "#f9f6f2"),
    2048: ("#edc22e", "#f9f6f2"),
}

class Game2048(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("2048 Cloud Gaming Edition")
        self.geometry("500x600")
        self.configure(bg="#faf8ef")
        self.resizable(False, False)

        self.score = 0
        self.grid_size = 4
        self.board = [[0] * self.grid_size for _ in range(self.grid_size)]

        self._create_widgets()
        self._bind_keys()
        self._spawn_tile()
        self._spawn_tile()
        self._update_board()

    def _create_widgets(self):
        header = tk.Frame(self, bg="#faf8ef", pady=15)
        header.pack(fill=tk.X, padx=20)

        title = tk.Label(header, text="2048", font=("Helvetica", 36, "bold"), fg="#776e65", bg="#faf8ef")
        title.pack(side=tk.LEFT)

        score_frame = tk.Frame(header, bg="#bbada0", padx=15, pady=5)
        score_frame.pack(side=tk.RIGHT)
        
        lbl = tk.Label(score_frame, text="SCORE", font=("Helvetica", 10, "bold"), fg="#eee4da", bg="#bbada0")
        lbl.pack()
        self.score_label = tk.Label(score_frame, text="0", font=("Helvetica", 18, "bold"), fg="#ffffff", bg="#bbada0")
        self.score_label.pack()

        # Board container
        board_container = tk.Frame(self, bg="#bbada0", bd=10)
        board_container.pack(padx=20, pady=10)

        self.cell_labels = []
        for r in range(self.grid_size):
            row_labels = []
            for c in range(self.grid_size):
                cell = tk.Label(
                    board_container,
                    text="",
                    width=4,
                    height=2,
                    font=("Helvetica", 22, "bold"),
                    bg="#cdc1b4"
                )
                cell.grid(row=r, column=c, padx=6, pady=6)
                row_labels.append(cell)
            self.cell_labels.append(row_labels)

        # Instructions
        footer = tk.Label(
            self,
            text="Use Arrow Keys or WASD to Slide Tiles",
            font=("Helvetica", 12),
            fg="#8f7a66",
            bg="#faf8ef",
            pady=10
        )
        footer.pack()

    def _bind_keys(self):
        self.bind("<Up>", lambda e: self._move("up"))
        self.bind("<Down>", lambda e: self._move("down"))
        self.bind("<Left>", lambda e: self._move("left"))
        self.bind("<Right>", lambda e: self._move("right"))
        self.bind("w", lambda e: self._move("up"))
        self.bind("s", lambda e: self._move("down"))
        self.bind("a", lambda e: self._move("left"))
        self.bind("d", lambda e: self._move("right"))
        self.bind("r", lambda e: self._restart())
        self.bind("<Escape>", lambda e: self.destroy())
        self.bind("q", lambda e: self.destroy())

    def _spawn_tile(self):
        empty_cells = [(r, c) for r in range(self.grid_size) for c in range(self.grid_size) if self.board[r][c] == 0]
        if empty_cells:
            r, c = random.choice(empty_cells)
            self.board[r][c] = 4 if random.random() < 0.1 else 2

    def _update_board(self):
        self.score_label.configure(text=str(self.score))
        for r in range(self.grid_size):
            for c in range(self.grid_size):
                val = self.board[r][c]
                bg_color, fg_color = COLORS.get(val, ("#3c3a32", "#f9f6f2"))
                text = str(val) if val > 0 else ""
                self.cell_labels[r][c].configure(text=text, bg=bg_color, fg=fg_color)

    def _compress(self, row):
        new_row = [x for x in row if x != 0]
        new_row += [0] * (self.grid_size - len(new_row))
        return new_row

    def _merge(self, row):
        for i in range(self.grid_size - 1):
            if row[i] != 0 and row[i] == row[i + 1]:
                row[i] *= 2
                self.score += row[i]
                row[i + 1] = 0
        return row

    def _move_left(self):
        moved = False
        for r in range(self.grid_size):
            compressed = self._compress(self.board[r])
            merged = self._merge(compressed)
            final_row = self._compress(merged)
            if final_row != self.board[r]:
                moved = True
                self.board[r] = final_row
        return moved

    def _move(self, direction):
        moved = False
        if direction == "left":
            moved = self._move_left()
        elif direction == "right":
            self.board = [r[::-1] for r in self.board]
            moved = self._move_left()
            self.board = [r[::-1] for r in self.board]
        elif direction == "up":
            self.board = [list(r) for r in zip(*self.board)]
            moved = self._move_left()
            self.board = [list(r) for r in zip(*self.board)]
        elif direction == "down":
            self.board = [list(r)[::-1] for r in zip(*self.board)]
            moved = self._move_left()
            self.board = [list(r) for r in zip(*self.board)][::-1]

        if moved:
            self._spawn_tile()
            self._update_board()

    def _restart(self):
        self.score = 0
        self.board = [[0] * self.grid_size for _ in range(self.grid_size)]
        self._spawn_tile()
        self._spawn_tile()
        self._update_board()

if __name__ == "__main__":
    app = Game2048()
    app.mainloop()

