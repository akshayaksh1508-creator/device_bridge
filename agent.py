import socketio
import pyautogui

SERVER_URL = "http://localhost:3000"
ROOM_ID = input("Enter Host Room ID shown on website: ").strip().upper()

sio = socketio.Client()
pyautogui.FAILSAFE = True

@sio.event
def connect():
    print("Connected to DeviceBridge server")
    sio.emit("register-agent", {"roomId": ROOM_ID})

@sio.on("agent-registered")
def registered(data):
    print("Agent registered for room:", data["roomId"])

@sio.on("mouse-move")
def mouse_move(data):
    pyautogui.moveRel(int(data.get("dx", 0)), int(data.get("dy", 0)), duration=0)

@sio.on("left-click")
def left_click(data=None):
    pyautogui.click()

@sio.on("right-click")
def right_click(data=None):
    pyautogui.rightClick()

@sio.on("double-click")
def double_click(data=None):
    pyautogui.doubleClick()

@sio.on("scroll")
def scroll(data):
    pyautogui.scroll(int(data.get("amount", 0)))

@sio.on("keyboard-input")
def keyboard_input(data):
    pyautogui.write(str(data.get("text", "")), interval=0.01)

sio.connect(SERVER_URL)
sio.wait()
