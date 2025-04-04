import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const initializeSocket = () => {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001');
    
    socket.on('connect', () => {
      console.log('Connected to socket server');
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
  }
  
  return socket;
};

export const getSocket = () => {
  if (!socket) {
    return initializeSocket();
  }
  return socket;
};

export const joinDocument = (documentId: string) => {
  const socket = getSocket();
  socket?.emit('joinDocument', documentId);
};

export const leaveDocument = (documentId: string) => {
  const socket = getSocket();
  socket?.emit('leaveDocument', documentId);
};

export const addAnnotation = (annotation: any) => {
  const socket = getSocket();
  socket?.emit('addAnnotation', annotation);
}; 