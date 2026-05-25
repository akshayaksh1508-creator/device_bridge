const socket = io();
const $ = (id) => document.getElementById(id);

function startHost(){
  let room = '';
  socket.emit('create-room');

  socket.on('room-created', ({roomId}) => {
    room = roomId;
    $('roomId').textContent = roomId;
    $('status').textContent = 'Waiting for controller...';
    const link = `${location.origin}/controller.html?room=${roomId}`;
    new QRCode($('qrcode'), { text: link, width: 230, height: 230 });
    $('copyBtn').onclick = () => navigator.clipboard.writeText(link).then(()=> $('copyBtn').textContent='Copied!');
  });

  socket.on('access-request', ({deviceName}) => {
    $('deviceName').textContent = `Device: ${deviceName}`;
    $('requestModal').classList.add('show');
  });

  $('allowBtn').onclick = () => {
    socket.emit('approve-access');
    $('requestModal').classList.remove('show');
    $('status').textContent = 'Connected successfully';
    $('disconnectBtn').style.display = 'inline-flex';
    $('log').style.display = 'block';
  };

  $('rejectBtn').onclick = () => {
    socket.emit('reject-access');
    $('requestModal').classList.remove('show');
    $('status').textContent = 'Access rejected. Waiting again...';
  };

  $('disconnectBtn').onclick = () => socket.emit('disconnect-control');

  socket.on('controller-disconnected', () => {
    $('status').textContent = 'Controller disconnected. Waiting again...';
    $('disconnectBtn').style.display = 'none';
  });

  socket.on('agent-connected', () => $('agentStatus').textContent = `Desktop agent: connected to room ${room}`);
  socket.on('agent-disconnected', () => $('agentStatus').textContent = 'Desktop agent: disconnected');

  socket.on('command-log', ({event, payload}) => {
    const row = document.createElement('div');
    row.textContent = `${new Date().toLocaleTimeString()}  ${event}  ${JSON.stringify(payload)}`;
    $('log').prepend(row);
  });
}

function startController(){
  let connected = false;
  const params = new URLSearchParams(location.search);
  if(params.get('room')) $('roomInput').value = params.get('room');

  function connect(roomId){
    if(!roomId) return;
    $('connectStatus').textContent = 'Requesting host approval...';
    socket.emit('join-room', { roomId, deviceName: navigator.userAgent.includes('Mobile') ? 'Mobile Controller' : 'Controller Browser' });
  }

  $('connectBtn').onclick = () => connect($('roomInput').value.trim().toUpperCase());

  const qr = new Html5Qrcode('reader');
  qr.start({ facingMode: 'environment' }, { fps: 10, qrbox: 250 }, decoded => {
    try {
      const url = new URL(decoded);
      const room = url.searchParams.get('room');
      if(room){ $('roomInput').value = room; connect(room); qr.stop(); }
    } catch { $('roomInput').value = decoded; connect(decoded); qr.stop(); }
  }).catch(() => $('connectStatus').textContent = 'Camera blocked. Enter Room ID manually.');

  socket.on('join-error', ({message}) => $('connectStatus').textContent = message);
  socket.on('waiting-approval', () => $('connectStatus').textContent = 'Waiting for Host Device approval...');
  socket.on('access-rejected', () => $('connectStatus').textContent = 'Access rejected by host.');
  socket.on('access-approved', () => {
    connected = true;
    $('connectPage').style.display = 'none';
    $('controllerPage').style.display = 'block';
  });

  function send(event, payload={}){ if(connected) socket.emit(event, payload); }
  $('leftClick').onclick = () => send('left-click');
  $('rightClick').onclick = () => send('right-click');
  $('scrollUp').onclick = () => send('scroll', {amount: 5});
  $('scrollDown').onclick = () => send('scroll', {amount: -5});
  $('sendText').onclick = () => { send('keyboard-input', {text: $('keyboardText').value}); $('keyboardText').value=''; };
  $('endControl').onclick = () => socket.emit('disconnect-control');

  let lastX = 0, lastY = 0, lastTap = 0;
  const pad = $('touchpad');
  pad.addEventListener('pointerdown', e => { lastX = e.clientX; lastY = e.clientY; });
  pad.addEventListener('pointermove', e => {
    if(e.buttons !== 1) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    send('mouse-move', {dx: Math.round(dx*1.6), dy: Math.round(dy*1.6)});
  });
  pad.addEventListener('click', () => {
    const now = Date.now();
    if(now - lastTap < 280) send('double-click'); else send('left-click');
    lastTap = now;
  });
  pad.addEventListener('contextmenu', e => { e.preventDefault(); send('right-click'); });

  $('gyroBtn').onclick = async () => {
    if(typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') await DeviceOrientationEvent.requestPermission();
    window.addEventListener('deviceorientation', e => {
      const dx = Math.round((e.gamma || 0) / 3);
      const dy = Math.round((e.beta || 0) / 6);
      if(Math.abs(dx)>1 || Math.abs(dy)>1) send('mouse-move', {dx, dy});
    });
    $('gyroBtn').textContent = 'Motion Mouse Enabled';
  };

  socket.on('host-disconnected', () => location.reload());
  socket.on('disconnected-by-user', () => location.reload());
}
