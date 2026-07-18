// ============================================================================
// Socket.IO Client Service — Real-time connection to DPI backend
// ============================================================================

import { io } from 'socket.io-client'
import { useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Backend URL — same base as the REST API
// In production:  the deployed backend URL
// In dev:         localhost:3000 (Vite proxy handles REST, WS goes direct)
// ---------------------------------------------------------------------------
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.DEV ? 'http://localhost:3000' : 'https://dpi-tqlz.onrender.com')

// ---------------------------------------------------------------------------
// Singleton socket instance
// ---------------------------------------------------------------------------
export const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  transports: ['websocket', 'polling'],
})

// ---------------------------------------------------------------------------
// useSocket — Custom hook to subscribe to a Socket.IO event
//
// Usage:
//   useSocket('traffic_update', (data) => {
//     setLogs(prev => [data, ...prev])
//   })
// ---------------------------------------------------------------------------
export function useSocket(event, callback) {
  const callbackRef = useRef(callback)

  // Keep the ref current so we don't re-subscribe on every render
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    const handler = (...args) => callbackRef.current(...args)
    socket.on(event, handler)
    return () => socket.off(event, handler)
  }, [event])
}

// ---------------------------------------------------------------------------
// useSocketStatus — Hook to track connection status
//
// Returns: { connected: boolean }
// ---------------------------------------------------------------------------
export function useSocketStatus() {
  const [connected, setConnected] = useState(socket.connected)

  useEffect(() => {
    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
    }
  }, [])

  return { connected }
}
