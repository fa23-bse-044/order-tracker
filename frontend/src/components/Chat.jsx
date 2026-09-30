import { useEffect, useRef, useState } from 'react';
import { socket } from '../api.js';

// WebSocket 1-on-1 chat room per order (Customer <-> Support)
export default function Chat({ orderId, role }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(socket.connected);
  const [roomReady, setRoomReady] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesPane = useRef();
  const shouldScroll = useRef(true);
  const timer = useRef();
  const lastTypingAt = useRef(0);

  useEffect(() => {
    let active = true;
    setMessages([]);
    setNotice('');
    setTyping('');
    setError('');
    setRoomReady(false);

    const joinRoom = () => {
      setRoomReady(false);
      socket.timeout(5000).emit('room:join', { orderId, role }, (timeoutError, result) => {
        if (!active) return;
        if (timeoutError || result?.error) {
          setError(result?.error || 'Could not join this conversation. Check that the order exists and try again.');
          return;
        }
        setRoomReady(true);
        setError('');
      });
    };
    const onConnect = () => {
      setConnected(true);
      joinRoom();
    };
    const onDisconnect = () => {
      setConnected(false);
      setRoomReady(false);
    };
    const onHistory = ({ orderId: historyOrderId, messages: history = [] }) => {
      if (Number(historyOrderId) === Number(orderId)) setMessages(history);
    };
    const onMessage = (message) => {
      if (Number(message.orderId) === Number(orderId)) {
        setMessages((previous) => previous.some((item) => item.time === message.time && item.sender === message.sender)
          ? previous
          : [...previous, message]);
      }
    };
    const onTyping = ({ orderId: typingOrderId, sender }) => {
      if (Number(typingOrderId) !== Number(orderId) || sender === role) return;
      setTyping(`${sender} is typing...`);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setTyping(''), 1500);
    };
    const onRoomJoined = ({ role: joinedRole, orderId: joinedOrderId }) => {
      if (Number(joinedOrderId) === Number(orderId)) setNotice(`${joinedRole} joined the chat`);
    };
    const onRoomNotice = ({ text: noticeText }) => setNotice(noticeText);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('chat:history', onHistory);
    socket.on('chat:message', onMessage);
    socket.on('chat:typing', onTyping);
    socket.on('room:joined', onRoomJoined);
    socket.on('room:notice', onRoomNotice);
    setConnected(socket.connected);
    if (socket.connected) joinRoom();

    return () => {
      active = false;
      clearTimeout(timer.current);
      if (socket.connected) socket.emit('room:leave', { orderId });
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('chat:history', onHistory);
      socket.off('chat:message', onMessage);
      socket.off('chat:typing', onTyping);
      socket.off('room:joined', onRoomJoined);
      socket.off('room:notice', onRoomNotice);
    };
  }, [orderId, role]);

  useEffect(() => {
    const pane = messagesPane.current;
    if (pane && shouldScroll.current) pane.scrollTo({ top: pane.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const onMessagesScroll = () => {
    const pane = messagesPane.current;
    if (pane) shouldScroll.current = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 80;
  };

  const send = (e) => {
    e.preventDefault();
    const messageText = text.trim();
    if (!messageText || sending) return;
    if (!connected || !roomReady) {
      setError(connected ? 'Joining your conversation… please try again in a moment.' : 'You are offline. Reconnect to send your message.');
      return;
    }

    setSending(true);
    setError('');
    socket.timeout(5000).emit('chat:message', { orderId, sender: role, text: messageText }, (timeoutError, result) => {
      setSending(false);
      if (timeoutError || result?.error) {
        setError(result?.error || 'Message was not delivered. Please try again.');
        return;
      }
      setText('');
    });
  };

  const updateText = (value) => {
    setText(value);
    const now = Date.now();
    if (connected && roomReady && now - lastTypingAt.current > 500) {
      socket.emit('chat:typing', { orderId, sender: role });
      lastTypingAt.current = now;
    }
  };

  return (
    <div className="chat">
      <div className="chat-heading"><span className="chat-avatar">{role === 'customer' ? 'S' : 'C'}</span><div><h3>{role === 'customer' ? 'Support team' : 'Customer'}</h3><p>Conversation for order #{orderId}</p></div><span className={`chat-live ${connected && roomReady ? 'is-online' : 'is-offline'}`}><i />{connected ? roomReady ? 'Connected' : 'Joining…' : 'Offline'}</span></div>
      <div className="msgs" ref={messagesPane} onScroll={onMessagesScroll} aria-live="polite">
        {messages.length === 0 && <div className="chat-start"><span>✦</span><strong>Start the conversation</strong><p>Send a message to get things moving.</p></div>}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.sender === role ? 'me' : 'them'}`}>
            <small>{m.sender} · {new Date(m.time).toLocaleTimeString()}</small>
            <div>{m.text}</div>
          </div>
        ))}
      </div>
      <div className={`hint ${error ? 'hint-error' : ''}`} role={error ? 'alert' : 'status'}>{error || typing || notice || (sending ? 'Sending message…' : '')}</div>
      <form onSubmit={send}>
        <input
          value={text}
          aria-label="Type a message"
          placeholder="Write a message..."
          onChange={(e) => updateText(e.target.value)}
          disabled={!connected || !roomReady || sending}
        />
        <button aria-label="Send message" disabled={!connected || !roomReady || sending || !text.trim()}>{sending ? 'Sending…' : <>Send <span>↑</span></>}</button>
      </form>
    </div>
  );
}
