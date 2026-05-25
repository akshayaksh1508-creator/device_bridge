<<<<<<< HEAD
# DeviceBridge

QR-based remote device controller website.

## Run website

```bash
npm install
npm start
```

Open:

```txt
http://localhost:3000
```

## Real mouse control on host computer

Install Python packages:

```bash
pip install pyautogui python-socketio
```

Start website, open Host Device page, then run:

```bash
python agent.py
```

Enter the Room ID shown on Host page.

## Important

The web browser cannot directly control system mouse due to security restrictions. Real mouse and keyboard control works through `agent.py` running on the host computer.
=======
# device_bridge
>>>>>>> 249c675a98bf0f43589d6580f41c198bfdabe68d
