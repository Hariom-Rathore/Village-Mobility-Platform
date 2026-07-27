function emitToUser(io, userId, eventType, data) {
  if (!io || !userId) return;
  try {
    io.to(userId.toString()).emit(eventType, data);
  } catch (error) {
    console.error('Error emitting to user:', error);
  }
}

function emitBookingUpdate(io, customerId, ownerId, eventType, data) {
  if (!io) return;
  if (customerId) {
    emitToUser(io, customerId, eventType, { ...data, recipientType: 'customer' });
  }
  if (ownerId && ownerId.toString() !== customerId?.toString()) {
    emitToUser(io, ownerId, eventType, { ...data, recipientType: 'owner' });
  }
}

function emitToAll(io, eventType, data) {
  if (!io) return;
  try {
    io.emit(eventType, data);
  } catch (error) {
    console.error('Error emitting to all:', error);
  }
}

module.exports = {
  emitToUser,
  emitBookingUpdate,
  emitToAll
};
