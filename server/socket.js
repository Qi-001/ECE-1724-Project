const { Server } = require('socket.io');
const http = require('http');

// Create HTTP server
const server = http.createServer();

// Initialize Socket.io server
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Track connected clients
const connectedClients = new Map();

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  connectedClients.set(socket.id, { documents: new Set() });

  // Handle joining a document room
  socket.on('joinDocument', (documentId) => {
    if (!documentId) return;
    
    // Add user to document room
    socket.join(documentId);
    
    // Track which documents this client is viewing
    const clientData = connectedClients.get(socket.id);
    if (clientData) {
      clientData.documents.add(documentId);
    }
    
    console.log(`Client ${socket.id} joined document: ${documentId}`);
    
    // Notify others that someone joined (optional)
    socket.to(documentId).emit('userJoined', {
      socketId: socket.id,
      timestamp: new Date(),
    });
  });

  // Handle leaving a document room
  socket.on('leaveDocument', (documentId) => {
    if (!documentId) return;
    
    // Remove user from document room
    socket.leave(documentId);
    
    // Update tracking
    const clientData = connectedClients.get(socket.id);
    if (clientData) {
      clientData.documents.delete(documentId);
    }
    
    console.log(`Client ${socket.id} left document: ${documentId}`);
  });

  // Handle new annotations
  socket.on('addAnnotation', (annotation) => {
    if (!annotation || !annotation.documentId) return;
    
    console.log(`New annotation from ${socket.id} for document ${annotation.documentId}`);
    
    // Broadcast to all clients in the document room (except sender)
    socket.to(annotation.documentId).emit('newAnnotation', annotation);
  });

  // Handle real-time typing events
  socket.on('userTyping', (data) => {
    if (!data || !data.documentId || !data.user || !data.content) return;
    
    console.log(`User typing: ${data.user.name || data.user.email} in document ${data.documentId}`);
    
    // Broadcast to all clients in the document room (except sender)
    socket.to(data.documentId).emit('userTyping', {
      user: data.user,
      content: data.content
    });
  });

  // Handle real-time annotation updates
  socket.on('updateAnnotation', (annotation) => {
    if (!annotation || !annotation.documentId) return;
    
    console.log(`Annotation update from ${socket.id} for document ${annotation.documentId}`);
    
    // Broadcast to all clients in the document room (except sender)
    socket.to(annotation.documentId).emit('annotationUpdated', annotation);
  });

  // Handle client disconnection
  socket.on('disconnect', () => {
    // Get the documents this client was viewing
    const clientData = connectedClients.get(socket.id);
    
    if (clientData) {
      // Notify others in each document room that this user left
      clientData.documents.forEach((documentId) => {
        socket.to(documentId).emit('userLeft', {
          socketId: socket.id,
          timestamp: new Date(),
        });
      });
    }
    
    // Remove client from tracking
    connectedClients.delete(socket.id);
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Start server
const PORT = process.env.SOCKET_PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
}); 